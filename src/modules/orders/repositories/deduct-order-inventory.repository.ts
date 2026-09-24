import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

type InventoryRequirementRow = RowDataPacket & {
  orderItemId: string;
  inventoryItemId: string;
  requiredQuantity: string;
};

type LockedInventoryItemRow = RowDataPacket & {
  id: string;
  currentStock: string;
  isActive: number;
};

type ExistingMovementRow = RowDataPacket & {
  id: string;
  sourceId: string;
};

type DeductOrderInventoryResult =
  | Readonly<{
      kind: "DEDUCTED";
      movementIds: readonly string[];
    }>
  | Readonly<{
      kind: "NO_LINKED_INVENTORY";
    }>
  | Readonly<{
      kind: "ALREADY_DEDUCTED";
      movementIds: readonly string[];
    }>
  | Readonly<{
      kind: "INVENTORY_ITEM_NOT_AVAILABLE";
      inventoryItemId: string;
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

const deductOrderInventory = async (
  connection: PoolConnection,
  businessId: string,
  membershipId: string,
  orderId: string,
): Promise<DeductOrderInventoryResult> => {
  const [requirementRows] = await connection.execute<InventoryRequirementRow[]>(
    `
        SELECT
          CAST(oi.id AS CHAR) AS orderItemId,
          CAST(pil.inventory_item_id AS CHAR)
            AS inventoryItemId,
          CAST(
            oi.quantity * pil.quantity_per_product
            AS CHAR
          ) AS requiredQuantity
        FROM order_items AS oi
        INNER JOIN product_inventory_links AS pil
          ON pil.business_id = oi.business_id
          AND pil.product_id = oi.product_id
          AND pil.is_active = TRUE
          AND pil.auto_deduct = TRUE
        WHERE
          oi.business_id = ?
          AND oi.order_id = ?
          AND oi.status = 'ACTIVE'
        ORDER BY
          oi.id ASC,
          pil.inventory_item_id ASC
      `,
    [businessId, orderId],
  );

  if (requirementRows.length === 0) {
    return {
      kind: "NO_LINKED_INVENTORY",
    };
  }

  const orderItemIds = [
    ...new Set(requirementRows.map((requirement) => requirement.orderItemId)),
  ];

  const orderItemPlaceholders = orderItemIds.map(() => "?").join(", ");

  const [existingMovementRows] = await connection.execute<
    ExistingMovementRow[]
  >(
    `
        SELECT
          CAST(id AS CHAR) AS id,
          source_id AS sourceId
        FROM inventory_movements
        WHERE
          business_id = ?
          AND movement_type = 'SALE'
          AND source_type = 'ORDER_ITEM'
          AND source_id IN (${orderItemPlaceholders})
        ORDER BY id ASC
      `,
    [businessId, ...orderItemIds],
  );

  if (existingMovementRows.length === orderItemIds.length) {
    return {
      kind: "ALREADY_DEDUCTED",
      movementIds: existingMovementRows.map((movement) => movement.id),
    };
  }

  const existingMovementByOrderItemId = new Map(
    existingMovementRows.map((movement) => [movement.sourceId, movement.id]),
  );

  const inventoryItemIds = [
    ...new Set(
      requirementRows.map((requirement) => requirement.inventoryItemId),
    ),
  ].sort((first, second) => {
    const firstId = BigInt(first);
    const secondId = BigInt(second);

    if (firstId < secondId) {
      return -1;
    }

    if (firstId > secondId) {
      return 1;
    }

    return 0;
  });

  const inventoryItemPlaceholders = inventoryItemIds.map(() => "?").join(", ");

  const [inventoryItemRows] = await connection.execute<
    LockedInventoryItemRow[]
  >(
    `
        SELECT
          CAST(id AS CHAR) AS id,
          CAST(current_stock AS CHAR) AS currentStock,
          is_active AS isActive
        FROM inventory_items
        WHERE
          business_id = ?
          AND id IN (${inventoryItemPlaceholders})
        ORDER BY id ASC
        FOR UPDATE
      `,
    [businessId, ...inventoryItemIds],
  );

  const inventoryItemById = new Map(
    inventoryItemRows.map((inventoryItem) => [inventoryItem.id, inventoryItem]),
  );

  for (const requirement of requirementRows) {
    const inventoryItem = inventoryItemById.get(requirement.inventoryItemId);

    if (inventoryItem?.isActive !== 1) {
      return {
        kind: "INVENTORY_ITEM_NOT_AVAILABLE",
        inventoryItemId: requirement.inventoryItemId,
      };
    }
  }

  const requirementsByOrderItem = new Map<string, InventoryRequirementRow[]>();

  for (const requirement of requirementRows) {
    const currentRequirements =
      requirementsByOrderItem.get(requirement.orderItemId) ?? [];

    currentRequirements.push(requirement);

    requirementsByOrderItem.set(requirement.orderItemId, currentRequirements);
  }

  const movementIds: string[] = [];

  for (const [orderItemId, requirements] of requirementsByOrderItem) {
    const existingMovementId = existingMovementByOrderItemId.get(orderItemId);

    if (existingMovementId) {
      movementIds.push(existingMovementId);
      continue;
    }

    const [movementResult] = await connection.execute<ResultSetHeader>(
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
            'SALE',
            'ORDER_ITEM',
            ?,
            ?,
            ?
          )
        `,
      [
        businessId,
        orderItemId,
        `Descuento automático del producto ${orderItemId} de la orden ${orderId}`,
        membershipId,
      ],
    );

    const movementId = movementResult.insertId.toString();

    movementIds.push(movementId);

    for (const requirement of requirements) {
      const inventoryItem = inventoryItemById.get(requirement.inventoryItemId);

      if (!inventoryItem) {
        throw new Error(
          "No fue posible recuperar el artículo de inventario validado",
        );
      }

      const balanceBefore = decimalToThousandths(inventoryItem.currentStock);

      const quantity = decimalToThousandths(requirement.requiredQuantity);

      const balanceAfter = balanceBefore - quantity;

      const quantityText = thousandthsToDecimal(quantity);
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
          VALUES (?, ?, ?, 'OUT', ?, ?, ?, ?)
        `,
        [
          businessId,
          movementId,
          inventoryItem.id,
          quantityText,
          balanceBeforeText,
          balanceAfterText,
          `Venta del producto ${orderItemId}`,
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
  }

  return {
    kind: "DEDUCTED",
    movementIds,
  };
};

export { deductOrderInventory };
export type { DeductOrderInventoryResult };
