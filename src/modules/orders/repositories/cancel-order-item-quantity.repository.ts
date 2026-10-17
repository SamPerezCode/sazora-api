import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import { AppError } from "../../../shared/errors/app-error";

import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import type { OrderItemStatus, OrderStatus } from "../order.types";

type CancellablePreparationStatus = Exclude<
  KitchenPreparationStatus,
  "DELIVERED" | "CANCELLED"
>;

type OrderRow = RowDataPacket & {
  status: OrderStatus;
  locationId: string;
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
  unitCost: string | null;
  totalCost: string | null;
};

type ReversedLineRow = RowDataPacket & {
  inventoryItemId: string;
  quantity: string;
  totalCost: string | null;
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

const QUANTITY_SCALE = 3;
const COST_SCALE = 6;

const reversePartialInventory = async (
  connection: PoolConnection,
  businessId: string,
  membershipId: string,
  orderId: string,
  orderItemId: string,
  locationId: string,
  previousQuantity: number,
  cancelledQuantity: number,
  remainingQuantity: number,
  reason: string,
): Promise<string | null> => {
  const [saleLineRows] = await connection.execute<SaleLineRow[]>(
    `
        SELECT
          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,

          CAST(SUM(iml.quantity) AS CHAR)
            AS quantity,

          CASE
            WHEN
              COUNT(iml.unit_cost) = COUNT(*)
              AND COUNT(iml.total_cost) = COUNT(*)
            THEN CAST(
              SUM(iml.total_cost) / SUM(iml.quantity)
              AS CHAR
            )
            ELSE NULL
          END AS unitCost,

          CASE
            WHEN COUNT(iml.total_cost) = COUNT(*)
              THEN CAST(SUM(iml.total_cost) AS CHAR)
            ELSE NULL
          END AS totalCost

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
          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,

          CAST(SUM(iml.quantity) AS CHAR)
            AS quantity,

          CASE
            WHEN COUNT(iml.total_cost) = COUNT(*)
              THEN CAST(SUM(iml.total_cost) AS CHAR)
            ELSE NULL
          END AS totalCost

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

  const reversedByInventoryItemId = new Map(
    reversedLineRows.map((line) => [line.inventoryItemId, line]),
  );

  const linesToReverse = saleLineRows
    .map((saleLine) => {
      const soldQuantity = decimalToScaledBigInt(
        saleLine.quantity,
        QUANTITY_SCALE,
      );

      const previousReversal = reversedByInventoryItemId.get(
        saleLine.inventoryItemId,
      );

      const alreadyReversedQuantity =
        previousReversal === undefined
          ? 0n
          : decimalToScaledBigInt(previousReversal.quantity, QUANTITY_SCALE);

      const stillConsumedQuantity = soldQuantity - alreadyReversedQuantity;

      if (stillConsumedQuantity <= 0n) {
        return null;
      }

      /*
       * previousQuantity representa las unidades comerciales
       * que continúan activas antes de esta cancelación.
       */
      const quantityToReverse =
        (stillConsumedQuantity * BigInt(cancelledQuantity)) /
        BigInt(previousQuantity);

      if (quantityToReverse <= 0n) {
        return null;
      }

      const soldTotalCost =
        saleLine.totalCost === null
          ? null
          : decimalToScaledBigInt(saleLine.totalCost, COST_SCALE);

      const previousReversalHasUnknownCost =
        previousReversal?.totalCost === null;

      const alreadyReversedTotalCost =
        previousReversal?.totalCost == null
          ? 0n
          : decimalToScaledBigInt(previousReversal.totalCost, COST_SCALE);

      const stillConsumedTotalCost =
        soldTotalCost === null || previousReversalHasUnknownCost
          ? null
          : soldTotalCost - alreadyReversedTotalCost;

      if (stillConsumedTotalCost !== null && stillConsumedTotalCost < 0n) {
        throw new Error("El costo revertido supera el costo de la venta");
      }

      /*
       * El residuo de redondeo permanece consumido.
       * Si posteriormente se cancela todo el producto, la
       * cancelación completa devolverá exactamente ese residuo.
       */
      const totalCostToReverse =
        stillConsumedTotalCost === null
          ? null
          : (stillConsumedTotalCost * BigInt(cancelledQuantity)) /
            BigInt(previousQuantity);

      return {
        inventoryItemId: saleLine.inventoryItemId,

        direction: "IN" as const,

        quantity: scaledBigIntToDecimal(quantityToReverse, QUANTITY_SCALE),

        unitCost: saleLine.unitCost,

        totalCost:
          totalCostToReverse === null
            ? null
            : scaledBigIntToDecimal(totalCostToReverse, COST_SCALE),

        notes: `Reversión parcial del producto ` + `${orderItemId}`,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (linesToReverse.length === 0) {
    return null;
  }

  const sourceId =
    `${orderItemId}:PARTIAL:` + `${previousQuantity}:${remainingQuantity}`;

  const movementResult = await applyLocationInventoryMovement(
    connection,
    businessId,
    membershipId,
    {
      locationId,
      movementType: "REVERSAL",
      returnKind: null,
      sourceType: "ORDER_ITEM_CANCELLATION",
      sourceId,
      externalReference: `ORDER:${orderId}`,
      notes:
        `Cancelación parcial del producto ${orderItemId} ` +
        `de la orden ${orderId}: ${reason}`,
      lines: linesToReverse,
    },
  );

  switch (movementResult.kind) {
    case "APPLIED":
      return movementResult.movementId;

    case "ITEM_NOT_AVAILABLE":
      throw new AppError(
        `El artículo ${movementResult.inventoryItemId} ` +
          "ya no está disponible",
        409,
        "INVENTORY_ITEM_NOT_AVAILABLE",
      );

    case "UNVALUED_STOCK":
      throw new AppError(
        `El artículo ${movementResult.inventoryItemId} ` +
          "tiene existencias sin valorar",
        409,
        "UNVALUED_INVENTORY_STOCK",
      );

    case "UNIT_COST_REQUIRED":
      throw new AppError(
        `No se conoce el costo histórico del artículo ` +
          `${movementResult.inventoryItemId}`,
        409,
        "INVENTORY_REVERSAL_COST_REQUIRED",
      );

    case "LOCATION_NOT_FOUND":
    case "LOCATION_INACTIVE":
    case "LOCATION_NOT_INVENTORY_ENABLED":
      throw new AppError(
        "La ubicación original de la venta no está disponible",
        409,
        "INVENTORY_LOCATION_NOT_AVAILABLE",
      );

    case "INSUFFICIENT_STOCK":
      throw new Error("Una reversión parcial produjo stock insuficiente");
  }
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
        SELECT
          status,
        CAST(location_id AS CHAR) AS locationId
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
      order.locationId,
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
