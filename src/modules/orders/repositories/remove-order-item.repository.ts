import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderStatus } from "../order.types";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type OrderItemIdentityRow = RowDataPacket & {
  id: string;
};

type RemoveOrderItemResult =
  | Readonly<{
      kind: "REMOVED";
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_OPEN";
    }>
  | Readonly<{
      kind: "ORDER_ITEM_NOT_FOUND";
    }>;

const removeOrderItem = async (
  businessId: string,
  orderId: string,
  orderItemId: string,
): Promise<RemoveOrderItemResult> => {
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

    const [orderItemRows] = await connection.execute<OrderItemIdentityRow[]>(
      `
          SELECT CAST(id AS CHAR) AS id
          FROM order_items
          WHERE
            business_id = ?
            AND order_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, orderId, orderItemId],
    );

    if (!orderItemRows[0]) {
      await connection.rollback();

      return {
        kind: "ORDER_ITEM_NOT_FOUND",
      };
    }

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM order_items
        WHERE
          business_id = ?
          AND order_id = ?
          AND id = ?
      `,
      [businessId, orderId, orderItemId],
    );

    await connection.commit();

    return {
      kind: "REMOVED",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { removeOrderItem };
export type { RemoveOrderItemResult };
