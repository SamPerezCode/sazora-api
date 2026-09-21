import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderStatus } from "../order.types";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type CloseOrderResult =
  | Readonly<{
      kind: "CLOSED";
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_DELIVERED";
    }>;

const closeOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
): Promise<CloseOrderResult> => {
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

    if (order.status !== "DELIVERED") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_DELIVERED",
      };
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          status = 'CLOSED',
          closed_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'DELIVERED'
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
        VALUES (?, ?, ?, 'DELIVERED', 'CLOSED', NULL)
      `,
      [businessId, orderId, membershipId],
    );

    await connection.commit();

    return {
      kind: "CLOSED",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { closeOrder };
export type { CloseOrderResult };
