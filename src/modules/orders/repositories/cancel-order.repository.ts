import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import type { OrderStatus } from "../order.types";
import { reverseOrderItemInventory } from "./reverse-order-item-inventory.repository";

type CancellableOrderStatus = "OPEN" | "CONFIRMED";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type ActiveOrderItemRow = RowDataPacket & {
  id: string;
  quantity: number;
};

type ConfirmedKitchenItemRow = RowDataPacket & {
  orderItemId: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus: KitchenPreparationStatus;
};

type CancelledConfirmedItemRow = RowDataPacket & {
  orderItemId: string;
  cancelledAt: Date;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  kitchenTicketVersion: number;
};

type CancelledConfirmedItem = Readonly<{
  orderItemId: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  kitchenTicketVersion: number;
  previousPreparationStatus: KitchenPreparationStatus;
  inventoryReversalMovementId: string | null;
  cancelledAt: Date;
}>;

type CancelOrderResult =
  | Readonly<{
      kind: "CANCELLED";
      previousStatus: CancellableOrderStatus;
      cancelledItemCount: number;
      cancelledItems: readonly CancelledConfirmedItem[];
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_CANCELLABLE";
      currentStatus: OrderStatus;
    }>
  | Readonly<{
      kind: "ORDER_HAS_DELIVERED_ITEMS";
    }>;

const cancelOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  reason: string,
): Promise<CancelOrderResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<OrderStateRow[]>(
      `
        SELECT status
        FROM orders
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    const order = orderRows[0];

    if (!order) {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_FOUND",
      };
    }

    if (order.status !== "OPEN" && order.status !== "CONFIRMED") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_CANCELLABLE",
        currentStatus: order.status,
      };
    }

    const previousStatus = order.status;

    const [activeOrderItemRows] = await connection.execute<
      ActiveOrderItemRow[]
    >(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          quantity
        FROM order_items
        WHERE
          business_id = ?
          AND order_id = ?
          AND status = 'ACTIVE'
        ORDER BY id ASC
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    let confirmedKitchenItemRows: ConfirmedKitchenItemRow[] = [];

    const inventoryReversalMovementIdByOrderItemId = new Map<
      string,
      string | null
    >();

    if (previousStatus === "CONFIRMED") {
      const [kitchenItemRows] = await connection.execute<
        ConfirmedKitchenItemRow[]
      >(
        `
          SELECT
            CAST(kti.order_item_id AS CHAR)
              AS orderItemId,
            CAST(kti.kitchen_ticket_id AS CHAR)
              AS kitchenTicketId,
            CAST(kti.id AS CHAR)
              AS kitchenTicketItemId,
            kti.preparation_status
              AS preparationStatus
          FROM kitchen_ticket_items AS kti
          INNER JOIN order_items AS oi
            ON oi.business_id = kti.business_id
            AND oi.id = kti.order_item_id
          WHERE
            kti.business_id = ?
            AND kti.order_id = ?
            AND oi.status = 'ACTIVE'
          ORDER BY kti.id ASC
          FOR UPDATE
        `,
        [businessId, orderId],
      );

      confirmedKitchenItemRows = kitchenItemRows;

      if (confirmedKitchenItemRows.length !== activeOrderItemRows.length) {
        throw new Error(
          "No fue posible recuperar todas las comandas de la orden",
        );
      }

      if (
        confirmedKitchenItemRows.some(
          (item) => item.preparationStatus === "DELIVERED",
        )
      ) {
        await connection.rollback();

        return {
          kind: "ORDER_HAS_DELIVERED_ITEMS",
        };
      }

      if (
        confirmedKitchenItemRows.some(
          (item) => item.preparationStatus === "CANCELLED",
        )
      ) {
        throw new Error(
          "La orden contiene productos activos con comandas canceladas",
        );
      }

      for (const orderItem of activeOrderItemRows) {
        const inventoryReversal = await reverseOrderItemInventory(
          connection,
          businessId,
          membershipId,
          orderId,
          orderItem.id,
          reason,
        );

        const movementId =
          inventoryReversal.kind === "NO_INVENTORY_MOVEMENT"
            ? null
            : inventoryReversal.movementId;

        inventoryReversalMovementIdByOrderItemId.set(orderItem.id, movementId);
      }
    }

    if (activeOrderItemRows.length > 0) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE order_items
          SET
            status = 'CANCELLED',
            cancelled_by_membership_id = ?,
            cancellation_reason = ?,
            cancelled_at = CURRENT_TIMESTAMP(3)
          WHERE
            business_id = ?
            AND order_id = ?
            AND status = 'ACTIVE'
        `,
        [membershipId, reason, businessId, orderId],
      );

      for (const orderItem of activeOrderItemRows) {
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
              'CANCELLED',
              ?,
              NULL,
              NULL,
              NULL,
              ?
            )
          `,
          [businessId, orderItem.id, membershipId, orderItem.quantity, reason],
        );
      }
    }

    if (previousStatus === "CONFIRMED" && confirmedKitchenItemRows.length > 0) {
      for (const kitchenItem of confirmedKitchenItemRows) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE kitchen_ticket_items
            SET
              preparation_status = 'CANCELLED',
              cancelled_at = CURRENT_TIMESTAMP(3),
              last_changed_by_membership_id = ?
            WHERE
              business_id = ?
              AND kitchen_ticket_id = ?
              AND id = ?
          `,
          [
            membershipId,
            businessId,
            kitchenItem.kitchenTicketId,
            kitchenItem.kitchenTicketItemId,
          ],
        );

        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO kitchen_item_status_history (
              business_id,
              kitchen_ticket_item_id,
              changed_by_membership_id,
              previous_status,
              new_status,
              reason
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              'CANCELLED',
              ?
            )
          `,
          [
            businessId,
            kitchenItem.kitchenTicketItemId,
            membershipId,
            kitchenItem.preparationStatus,
            reason,
          ],
        );
      }

      const affectedKitchenTicketIds = [
        ...new Set(
          confirmedKitchenItemRows.map((item) => item.kitchenTicketId),
        ),
      ].sort((left, right) => left.localeCompare(right));

      for (const kitchenTicketId of affectedKitchenTicketIds) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE kitchen_tickets
            SET
              current_version =
                current_version + 1,
              last_modified_by_membership_id = ?
            WHERE
              business_id = ?
              AND id = ?
          `,
          [membershipId, businessId, kitchenTicketId],
        );
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          status = 'CANCELLED',
          cancelled_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = ?
      `,
      [businessId, orderId, previousStatus],
    );

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO order_status_history (
          business_id,
          order_id,
          changed_by_membership_id,
          previous_status,
          new_status,
          reason
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          'CANCELLED',
          ?
        )
      `,
      [businessId, orderId, membershipId, previousStatus, reason],
    );

    const cancelledItems: CancelledConfirmedItem[] = [];

    if (previousStatus === "CONFIRMED" && activeOrderItemRows.length > 0) {
      const placeholders = activeOrderItemRows.map(() => "?").join(", ");

      const [cancelledItemRows] = await connection.execute<
        CancelledConfirmedItemRow[]
      >(
        `
            SELECT
              CAST(oi.id AS CHAR)
                AS orderItemId,
              oi.cancelled_at AS cancelledAt,
              CAST(kti.kitchen_ticket_id AS CHAR)
                AS kitchenTicketId,
              CAST(kti.id AS CHAR)
                AS kitchenTicketItemId,
              kt.current_version
                AS kitchenTicketVersion
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
              AND oi.id IN (${placeholders})
            ORDER BY oi.id ASC
          `,
        [businessId, orderId, ...activeOrderItemRows.map((item) => item.id)],
      );

      const kitchenItemByOrderItemId = new Map(
        confirmedKitchenItemRows.map((item) => [item.orderItemId, item]),
      );

      for (const cancelledItem of cancelledItemRows) {
        const previousKitchenItem = kitchenItemByOrderItemId.get(
          cancelledItem.orderItemId,
        );

        if (!previousKitchenItem) {
          throw new Error(
            "No fue posible recuperar el estado anterior de la comanda",
          );
        }

        cancelledItems.push({
          orderItemId: cancelledItem.orderItemId,
          kitchenTicketId: cancelledItem.kitchenTicketId,
          kitchenTicketItemId: cancelledItem.kitchenTicketItemId,
          kitchenTicketVersion: cancelledItem.kitchenTicketVersion,
          previousPreparationStatus: previousKitchenItem.preparationStatus,
          inventoryReversalMovementId:
            inventoryReversalMovementIdByOrderItemId.get(
              cancelledItem.orderItemId,
            ) ?? null,
          cancelledAt: cancelledItem.cancelledAt,
        });
      }

      if (cancelledItems.length !== activeOrderItemRows.length) {
        throw new Error(
          "No fue posible recuperar todos los productos cancelados",
        );
      }
    }

    await connection.commit();

    return {
      kind: "CANCELLED",
      previousStatus,
      cancelledItemCount: activeOrderItemRows.length,
      cancelledItems,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { cancelOrder };

export type { CancelOrderResult, CancelledConfirmedItem };
