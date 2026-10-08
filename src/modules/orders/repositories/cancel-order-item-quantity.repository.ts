import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import type { OrderItemStatus, OrderStatus } from "../order.types";

type CancellablePreparationStatus = Exclude<
  KitchenPreparationStatus,
  "DELIVERED" | "CANCELLED"
>;

type OrderRow = RowDataPacket & {
  status: OrderStatus;
};

type ItemContextRow = RowDataPacket & {
  quantity: number;
  orderItemStatus: OrderItemStatus;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus: KitchenPreparationStatus;
  kitchenTicketVersion: number;
};

type SaleLineRow = RowDataPacket & {
  inventoryItemId: string;
  quantity: string;
};

type ReversedLineRow = RowDataPacket & {
  inventoryItemId: string;
  quantity: string;
};

type InventoryItemRow = RowDataPacket & {
  id: string;
  currentStock: string;
};

type PartialCancellation = Readonly<{
  orderItemId: string;
  previousQuantity: number;
  cancelledQuantity: number;
  remainingQuantity: number;
  cancellationReason: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  kitchenTicketVersion: number;
  preparationStatus: CancellablePreparationStatus;
  orderStatus: "CONFIRMED";
  inventoryReversalMovementId: string | null;
  adjustedAt: Date;
}>;

type CancelOrderItemQuantityResult =
  | Readonly<{
      kind: "UPDATED";
      adjustment: PartialCancellation;
    }>
  | Readonly<{ kind: "ORDER_NOT_FOUND" }>
  | Readonly<{ kind: "ORDER_NOT_CONFIRMED" }>
  | Readonly<{ kind: "ORDER_ITEM_NOT_FOUND" }>
  | Readonly<{ kind: "ORDER_ITEM_NOT_CANCELLABLE" }>
  | Readonly<{
      kind: "INVALID_CANCELLED_QUANTITY";
      availableQuantity: number;
    }>
  | Readonly<{ kind: "FULL_CANCELLATION_REQUIRED" }>;

const decimalToThousandths = (value: string): bigint => {
  const normalized = value.trim();
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");

  const result =
    BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0").slice(0, 3));

  return negative ? -result : result;
};

const thousandthsToDecimal = (value: bigint): string => {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 1000n;
  const fraction = (absolute % 1000n).toString().padStart(3, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
};

const reversePartialInventory = async (
  connection: PoolConnection,
  businessId: string,
  membershipId: string,
  orderId: string,
  orderItemId: string,
  previousQuantity: number,
  cancelledQuantity: number,
  remainingQuantity: number,
  reason: string,
): Promise<string | null> => {
  const [saleLineRows] = await connection.execute<SaleLineRow[]>(
    `
      SELECT
        CAST(iml.inventory_item_id AS CHAR) AS inventoryItemId,
        CAST(SUM(iml.quantity) AS CHAR) AS quantity
      FROM inventory_movements AS im
      INNER JOIN inventory_movement_lines AS iml
        ON iml.business_id = im.business_id
        AND iml.movement_id = im.id
      WHERE
        im.business_id = ?
        AND im.movement_type = 'SALE'
        AND im.source_type = 'ORDER_ITEM'
        AND im.source_id = ?
        AND iml.direction = 'OUT'
      GROUP BY iml.inventory_item_id
      ORDER BY iml.inventory_item_id
    `,
    [businessId, orderItemId],
  );

  if (saleLineRows.length === 0) {
    return null;
  }

  const [reversedLineRows] = await connection.execute<ReversedLineRow[]>(
    `
      SELECT
        CAST(iml.inventory_item_id AS CHAR) AS inventoryItemId,
        CAST(SUM(iml.quantity) AS CHAR) AS quantity
      FROM inventory_movements AS im
      INNER JOIN inventory_movement_lines AS iml
        ON iml.business_id = im.business_id
        AND iml.movement_id = im.id
      WHERE
        im.business_id = ?
        AND im.movement_type = 'REVERSAL'
        AND im.source_type = 'ORDER_ITEM_CANCELLATION'
        AND (
          im.source_id = ?
          OR im.source_id LIKE ?
        )
        AND iml.direction = 'IN'
      GROUP BY iml.inventory_item_id
    `,
    [businessId, orderItemId, `${orderItemId}:%`],
  );

  const reversedByInventoryItem = new Map(
    reversedLineRows.map((line) => [
      line.inventoryItemId,
      decimalToThousandths(line.quantity),
    ]),
  );

  const quantitiesToReverse = saleLineRows
    .map((saleLine) => {
      const sold = decimalToThousandths(saleLine.quantity);
      const alreadyReversed =
        reversedByInventoryItem.get(saleLine.inventoryItemId) ?? 0n;

      const stillConsumed = sold - alreadyReversed;

      if (stillConsumed <= 0n) {
        return null;
      }

      /*
       * La división se hace sobre el consumo que todavía corresponde
       * a las unidades activas. Los residuos de redondeo se devolverán
       * cuando se cancele completamente la línea.
       */
      const quantity =
        (stillConsumed * BigInt(cancelledQuantity)) / BigInt(previousQuantity);

      if (quantity <= 0n) {
        return null;
      }

      return {
        inventoryItemId: saleLine.inventoryItemId,
        quantity,
      };
    })
    .filter(
      (
        value,
      ): value is {
        inventoryItemId: string;
        quantity: bigint;
      } => value !== null,
    );

  if (quantitiesToReverse.length === 0) {
    return null;
  }

  const inventoryItemIds = quantitiesToReverse.map(
    (line) => line.inventoryItemId,
  );

  const placeholders = inventoryItemIds.map(() => "?").join(", ");

  const [inventoryRows] = await connection.execute<InventoryItemRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        CAST(current_stock AS CHAR) AS currentStock
      FROM inventory_items
      WHERE
        business_id = ?
        AND id IN (${placeholders})
      ORDER BY id
      FOR UPDATE
    `,
    [businessId, ...inventoryItemIds],
  );

  const inventoryById = new Map(inventoryRows.map((item) => [item.id, item]));

  if (inventoryById.size !== inventoryItemIds.length) {
    throw new Error("No fue posible recuperar los artículos de inventario");
  }

  const sourceId = `${orderItemId}:PARTIAL:${previousQuantity}:${remainingQuantity}`;

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
          'REVERSAL',
          'ORDER_ITEM_CANCELLATION',
          ?,
          ?,
          ?
        )
      `,
    [
      businessId,
      sourceId,
      `Cancelación parcial del producto ${orderItemId} ` +
        `de la orden ${orderId}: ${reason}`,
      membershipId,
    ],
  );

  const movementId = movementResult.insertId.toString();

  for (const reversal of quantitiesToReverse) {
    const inventoryItem = inventoryById.get(reversal.inventoryItemId);

    if (!inventoryItem) {
      throw new Error("No fue posible recuperar el artículo bloqueado");
    }

    const balanceBefore = decimalToThousandths(inventoryItem.currentStock);

    const balanceAfter = balanceBefore + reversal.quantity;

    const quantityText = thousandthsToDecimal(reversal.quantity);

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
        movementId,
        inventoryItem.id,
        quantityText,
        balanceBeforeText,
        balanceAfterText,
        `Reversión parcial del producto ${orderItemId}`,
      ],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE inventory_items
        SET current_stock = ?
        WHERE business_id = ? AND id = ?
      `,
      [balanceAfterText, businessId, inventoryItem.id],
    );

    inventoryItem.currentStock = balanceAfterText;
  }

  return movementId;
};

const cancelOrderItemQuantity = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  orderItemId: string,
  cancelledQuantity: number,
  reason: string,
): Promise<CancelOrderItemQuantityResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<OrderRow[]>(
      `
        SELECT status
        FROM orders
        WHERE business_id = ? AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    const order = orderRows[0];

    if (!order) {
      await connection.rollback();
      return { kind: "ORDER_NOT_FOUND" };
    }

    if (order.status !== "CONFIRMED") {
      await connection.rollback();
      return { kind: "ORDER_NOT_CONFIRMED" };
    }

    const [contextRows] = await connection.execute<ItemContextRow[]>(
      `
        SELECT
          oi.quantity,
          oi.status AS orderItemStatus,
          CAST(kti.kitchen_ticket_id AS CHAR)
            AS kitchenTicketId,
          CAST(kti.id AS CHAR)
            AS kitchenTicketItemId,
          kti.preparation_status AS preparationStatus,
          kt.current_version AS kitchenTicketVersion
        FROM order_items AS oi
        INNER JOIN kitchen_ticket_items AS kti
          ON kti.business_id = oi.business_id
          AND kti.order_item_id = oi.id
        INNER JOIN kitchen_tickets AS kt
          ON kt.business_id = kti.business_id
          AND kt.id = kti.kitchen_ticket_id
        WHERE
          oi.business_id = ?
          AND oi.order_id = ?
          AND oi.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, orderId, orderItemId],
    );

    const context = contextRows[0];

    if (!context) {
      await connection.rollback();

      return {
        kind: "ORDER_ITEM_NOT_FOUND",
      };
    }

    if (context.orderItemStatus !== "ACTIVE") {
      await connection.rollback();

      return {
        kind: "ORDER_ITEM_NOT_CANCELLABLE",
      };
    }

    const preparationStatus = context.preparationStatus;

    if (
      preparationStatus === "DELIVERED" ||
      preparationStatus === "CANCELLED"
    ) {
      await connection.rollback();

      return {
        kind: "ORDER_ITEM_NOT_CANCELLABLE",
      };
    }

    if (cancelledQuantity > context.quantity) {
      await connection.rollback();

      return {
        kind: "INVALID_CANCELLED_QUANTITY",
        availableQuantity: context.quantity,
      };
    }

    if (cancelledQuantity === context.quantity) {
      await connection.rollback();

      return {
        kind: "FULL_CANCELLATION_REQUIRED",
      };
    }

    const remainingQuantity = context.quantity - cancelledQuantity;

    const inventoryReversalMovementId = await reversePartialInventory(
      connection,
      businessId,
      membershipId,
      orderId,
      orderItemId,
      context.quantity,
      cancelledQuantity,
      remainingQuantity,
      reason,
    );

    const adjustedAt = new Date();

    await connection.execute<ResultSetHeader>(
      `
        UPDATE order_items
        SET quantity = ?, updated_at = ?
        WHERE
          business_id = ?
          AND order_id = ?
          AND id = ?
          AND status = 'ACTIVE'
      `,
      [remainingQuantity, adjustedAt, businessId, orderId, orderItemId],
    );

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO order_item_changes (
          business_id,
          order_item_id,
          changed_by_membership_id,
          change_type,
          previous_quantity,
          new_quantity,
          previous_notes,
          new_notes,
          reason
        )
        VALUES (
          ?,
          ?,
          ?,
          'QUANTITY_DECREASED',
          ?,
          ?,
          NULL,
          NULL,
          ?
        )
      `,
      [
        businessId,
        orderItemId,
        membershipId,
        context.quantity,
        remainingQuantity,
        reason,
      ],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE kitchen_tickets
        SET
          current_version = current_version + 1,
          last_modified_by_membership_id = ?,
          updated_at = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [membershipId, adjustedAt, businessId, context.kitchenTicketId],
    );

    await connection.commit();

    return {
      kind: "UPDATED",
      adjustment: {
        orderItemId,
        previousQuantity: context.quantity,
        cancelledQuantity,
        remainingQuantity,
        cancellationReason: reason,
        kitchenTicketId: context.kitchenTicketId,
        kitchenTicketItemId: context.kitchenTicketItemId,
        kitchenTicketVersion: context.kitchenTicketVersion + 1,
        preparationStatus,
        orderStatus: "CONFIRMED",
        inventoryReversalMovementId,
        adjustedAt,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { cancelOrderItemQuantity };
export type { CancelOrderItemQuantityResult, PartialCancellation };
