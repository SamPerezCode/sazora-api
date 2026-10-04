import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderStatus } from "../order.types";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type ActiveOrderItemRow = RowDataPacket & {
  id: string;
  quantity: number;
};

type CancelOpenOrderResult =
  | Readonly<{
      kind: "CANCELLED";
      cancelledItemCount: number;
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_OPEN";
    }>;

const cancelOpenOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  reason: string,
): Promise<CancelOpenOrderResult> => {
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

    if (order.status !== "OPEN") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_OPEN",
      };
    }

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

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          status = 'CANCELLED',
          cancelled_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'OPEN'
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
        VALUES (
          ?,
          ?,
          ?,
          'OPEN',
          'CANCELLED',
          ?
        )
      `,
      [businessId, orderId, membershipId, reason],
    );

    await connection.commit();

    return {
      kind: "CANCELLED",
      cancelledItemCount: activeOrderItemRows.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { cancelOpenOrder };
export type { CancelOpenOrderResult };
