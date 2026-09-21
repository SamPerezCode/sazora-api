import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import type { OrderItemStatus, OrderStatus } from "../order.types";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type OrderItemCancellationContextRow = RowDataPacket & {
  quantity: number;
  orderItemStatus: OrderItemStatus;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus: KitchenPreparationStatus;
};

type CountRow = RowDataPacket & {
  total: string;
};

type CancelledItemRow = RowDataPacket & {
  orderItemId: string;
  orderItemStatus: OrderItemStatus;
  cancellationReason: string;
  cancelledAt: Date;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus: KitchenPreparationStatus;
  kitchenTicketVersion: number;
};

type CancelledOrderItem = Readonly<{
  orderItemId: string;
  status: OrderItemStatus;
  cancellationReason: string;
  cancelledAt: Date;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus: KitchenPreparationStatus;
  kitchenTicketVersion: number;
  orderStatus: OrderStatus;
}>;

type CancelOrderItemResult =
  | Readonly<{
      kind: "CANCELLED";
      cancellation: CancelledOrderItem;
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_CONFIRMED";
    }>
  | Readonly<{
      kind: "ORDER_ITEM_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_ITEM_NOT_CANCELLABLE";
    }>;

const cancelOrderItem = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
): Promise<CancelOrderItemResult> => {
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

    if (order.status !== "CONFIRMED") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_CONFIRMED",
      };
    }

    const [contextRows] = await connection.execute<
      OrderItemCancellationContextRow[]
    >(
      `
          SELECT
            oi.quantity,
            oi.status AS orderItemStatus,
            CAST(kti.kitchen_ticket_id AS CHAR) AS kitchenTicketId,
            CAST(kti.id AS CHAR) AS kitchenTicketItemId,
            kti.preparation_status AS preparationStatus
          FROM order_items AS oi
          INNER JOIN kitchen_ticket_items AS kti
            ON kti.business_id = oi.business_id
            AND kti.order_item_id = oi.id
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

    if (
      context.orderItemStatus !== "ACTIVE" ||
      context.preparationStatus === "DELIVERED" ||
      context.preparationStatus === "CANCELLED"
    ) {
      await connection.rollback();

      return {
        kind: "ORDER_ITEM_NOT_CANCELLABLE",
      };
    }

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
          AND id = ?
          AND status = 'ACTIVE'
      `,
      [membershipId, reason, businessId, orderId, orderItemId],
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
          'CANCELLED',
          ?,
          NULL,
          NULL,
          NULL,
          ?
        )
      `,
      [businessId, orderItemId, membershipId, context.quantity, reason],
    );

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
        context.kitchenTicketId,
        context.kitchenTicketItemId,
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
        VALUES (?, ?, ?, ?, 'CANCELLED', ?)
      `,
      [
        businessId,
        context.kitchenTicketItemId,
        membershipId,
        context.preparationStatus,
        reason,
      ],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE kitchen_tickets
        SET
          current_version = current_version + 1,
          last_modified_by_membership_id = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [membershipId, businessId, context.kitchenTicketId],
    );

    const [activeItemRows] = await connection.execute<CountRow[]>(
      `
        SELECT CAST(COUNT(*) AS CHAR) AS total
        FROM order_items
        WHERE
          business_id = ?
          AND order_id = ?
          AND status = 'ACTIVE'
      `,
      [businessId, orderId],
    );

    const activeItemCount = Number(activeItemRows[0]?.total ?? 0);

    let orderStatus: OrderStatus = "CONFIRMED";

    if (activeItemCount === 0) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE orders
          SET
            status = 'CANCELLED',
            cancelled_at = CURRENT_TIMESTAMP(3)
          WHERE
            business_id = ?
            AND id = ?
            AND status = 'CONFIRMED'
        `,
        [businessId, orderId],
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
          VALUES (?, ?, ?, 'CONFIRMED', 'CANCELLED', ?)
        `,
        [businessId, orderId, membershipId, reason],
      );

      orderStatus = "CANCELLED";
    } else {
      const [remainingKitchenItemRows] = await connection.execute<CountRow[]>(
        `
          SELECT CAST(COUNT(*) AS CHAR) AS total
          FROM kitchen_ticket_items
          WHERE
            business_id = ?
            AND order_id = ?
            AND preparation_status NOT IN (
              'DELIVERED',
              'CANCELLED'
            )
        `,
        [businessId, orderId],
      );

      const remainingKitchenItemCount = Number(
        remainingKitchenItemRows[0]?.total ?? 0,
      );

      if (remainingKitchenItemCount === 0) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE orders
            SET
              status = 'DELIVERED',
              delivered_at = CURRENT_TIMESTAMP(3)
            WHERE
              business_id = ?
              AND id = ?
              AND status = 'CONFIRMED'
          `,
          [businessId, orderId],
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
            VALUES (?, ?, ?, 'CONFIRMED', 'DELIVERED', NULL)
          `,
          [businessId, orderId, membershipId],
        );

        orderStatus = "DELIVERED";
      }
    }

    const [cancelledItemRows] = await connection.execute<CancelledItemRow[]>(
      `
        SELECT
          CAST(oi.id AS CHAR) AS orderItemId,
          oi.status AS orderItemStatus,
          oi.cancellation_reason AS cancellationReason,
          oi.cancelled_at AS cancelledAt,
          CAST(kti.kitchen_ticket_id AS CHAR) AS kitchenTicketId,
          CAST(kti.id AS CHAR) AS kitchenTicketItemId,
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
      `,
      [businessId, orderId, orderItemId],
    );

    const cancelledItem = cancelledItemRows[0];

    if (!cancelledItem) {
      throw new Error("No fue posible recuperar el producto cancelado");
    }

    await connection.commit();

    return {
      kind: "CANCELLED",
      cancellation: {
        orderItemId: cancelledItem.orderItemId,
        status: cancelledItem.orderItemStatus,
        cancellationReason: cancelledItem.cancellationReason,
        cancelledAt: cancelledItem.cancelledAt,
        kitchenTicketId: cancelledItem.kitchenTicketId,
        kitchenTicketItemId: cancelledItem.kitchenTicketItemId,
        preparationStatus: cancelledItem.preparationStatus,
        kitchenTicketVersion: cancelledItem.kitchenTicketVersion,
        orderStatus,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { cancelOrderItem };
export type { CancelOrderItemResult, CancelledOrderItem };
