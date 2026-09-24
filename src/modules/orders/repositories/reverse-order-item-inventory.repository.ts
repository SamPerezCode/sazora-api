import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

type MovementRow = RowDataPacket & {
  id: string;
};

type SaleMovementLineRow = RowDataPacket & {
  inventoryItemId: string;
  quantity: string;
};

type LockedInventoryItemRow = RowDataPacket & {
  id: string;
  currentStock: string;
};

type ReverseOrderItemInventoryResult =
  | Readonly<{
      kind: "REVERSED";
      movementId: string;
    }>
  | Readonly<{
      kind: "NO_INVENTORY_MOVEMENT";
    }>
  | Readonly<{
      kind: "ALREADY_REVERSED";
      movementId: string;
    }>;

const decimalToThousandths = (value: string): bigint => {
  const normalizedValue = value.trim();
  const isNegative = normalizedValue.startsWith("-");
  const unsignedValue = isNegative ? normalizedValue.slice(1) : normalizedValue;

  const [whole = "0", fraction = ""] = unsignedValue.split(".");

  const quantity =
    BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0").slice(0, 3));

  return isNegative ? -quantity : quantity;
};

const thousandthsToDecimal = (value: bigint): string => {
  const isNegative = value < 0n;
  const absoluteValue = isNegative ? -value : value;

  const whole = absoluteValue / 1000n;
  const fraction = (absoluteValue % 1000n).toString().padStart(3, "0");

  return `${isNegative ? "-" : ""}${whole.toString()}.${fraction}`;
};

const reverseOrderItemInventory = async (
  connection: PoolConnection,
  businessId: string,
  membershipId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
): Promise<ReverseOrderItemInventoryResult> => {
  const [existingReversalRows] = await connection.execute<MovementRow[]>(
    `
        SELECT CAST(id AS CHAR) AS id
        FROM inventory_movements
        WHERE
          business_id = ?
          AND movement_type = 'REVERSAL'
          AND source_type = 'ORDER_ITEM_CANCELLATION'
          AND source_id = ?
        LIMIT 1
      `,
    [businessId, orderItemId],
  );

  const existingReversal = existingReversalRows[0];

  if (existingReversal) {
    return {
      kind: "ALREADY_REVERSED",
      movementId: existingReversal.id,
    };
  }

  const [saleMovementRows] = await connection.execute<MovementRow[]>(
    `
        SELECT CAST(id AS CHAR) AS id
        FROM inventory_movements
        WHERE
          business_id = ?
          AND movement_type = 'SALE'
          AND source_type = 'ORDER_ITEM'
          AND source_id = ?
        LIMIT 1
      `,
    [businessId, orderItemId],
  );

  const saleMovement = saleMovementRows[0];

  if (!saleMovement) {
    return {
      kind: "NO_INVENTORY_MOVEMENT",
    };
  }

  const [saleLineRows] = await connection.execute<SaleMovementLineRow[]>(
    `
        SELECT
          CAST(inventory_item_id AS CHAR)
            AS inventoryItemId,
          CAST(quantity AS CHAR) AS quantity
        FROM inventory_movement_lines
        WHERE
          business_id = ?
          AND movement_id = ?
          AND direction = 'OUT'
        ORDER BY inventory_item_id ASC
      `,
    [businessId, saleMovement.id],
  );

  if (saleLineRows.length === 0) {
    return {
      kind: "NO_INVENTORY_MOVEMENT",
    };
  }

  const inventoryItemIds = saleLineRows.map((line) => line.inventoryItemId);

  const placeholders = inventoryItemIds.map(() => "?").join(", ");

  const [inventoryItemRows] = await connection.execute<
    LockedInventoryItemRow[]
  >(
    `
        SELECT
          CAST(id AS CHAR) AS id,
          CAST(current_stock AS CHAR) AS currentStock
        FROM inventory_items
        WHERE
          business_id = ?
          AND id IN (${placeholders})
        ORDER BY id ASC
        FOR UPDATE
      `,
    [businessId, ...inventoryItemIds],
  );

  const inventoryItemById = new Map(
    inventoryItemRows.map((inventoryItem) => [inventoryItem.id, inventoryItem]),
  );

  if (inventoryItemById.size !== inventoryItemIds.length) {
    throw new Error(
      "No fue posible recuperar los artículos del movimiento de venta",
    );
  }

  const [reversalResult] = await connection.execute<ResultSetHeader>(
    `
        INSERT INTO inventory_movements (
          business_id,
          movement_type,
          source_type,
          source_id,
          notes,
          created_by_membership_id
        )
        VALUES (
          ?,
          'REVERSAL',
          'ORDER_ITEM_CANCELLATION',
          ?,
          ?,
          ?
        )
      `,
    [
      businessId,
      orderItemId,
      `Devolución del producto ${orderItemId} de la orden ${orderId}: ${reason}`,
      membershipId,
    ],
  );

  const reversalMovementId = reversalResult.insertId.toString();

  for (const saleLine of saleLineRows) {
    const inventoryItem = inventoryItemById.get(saleLine.inventoryItemId);

    if (!inventoryItem) {
      throw new Error(
        "No fue posible recuperar el artículo de inventario bloqueado",
      );
    }

    const balanceBefore = decimalToThousandths(inventoryItem.currentStock);

    const quantity = decimalToThousandths(saleLine.quantity);

    const balanceAfter = balanceBefore + quantity;

    const balanceBeforeText = thousandthsToDecimal(balanceBefore);
    const balanceAfterText = thousandthsToDecimal(balanceAfter);

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO inventory_movement_lines (
          business_id,
          movement_id,
          inventory_item_id,
          direction,
          quantity,
          balance_before,
          balance_after,
          notes
        )
        VALUES (?, ?, ?, 'IN', ?, ?, ?, ?)
      `,
      [
        businessId,
        reversalMovementId,
        inventoryItem.id,
        saleLine.quantity,
        balanceBeforeText,
        balanceAfterText,
        `Reversión por cancelación del producto ${orderItemId}`,
      ],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE inventory_items
        SET current_stock = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [balanceAfterText, businessId, inventoryItem.id],
    );

    inventoryItem.currentStock = balanceAfterText;
  }

  return {
    kind: "REVERSED",
    movementId: reversalMovementId,
  };
};

export { reverseOrderItemInventory };
export type { ReverseOrderItemInventoryResult };
