import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  OrderServiceType,
  OrderStatus,
  UpdateOrderData,
} from "../order.types";

type CurrentOrderRow = RowDataPacket & {
  status: OrderStatus;
  serviceType: OrderServiceType;
  restaurantTableId: string | null;
  customerCount: number | null;
  notes: string | null;
};

type RestaurantTableStateRow = RowDataPacket & {
  isActive: number;
};

type ActiveOrderRow = RowDataPacket & {
  id: string;
};

type UpdateOrderResult =
  | Readonly<{
      kind: "UPDATED";
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_OPEN";
    }>
  | Readonly<{
      kind: "TABLE_NOT_FOUND";
    }>
  | Readonly<{
      kind: "TABLE_INACTIVE";
    }>
  | Readonly<{
      kind: "TABLE_OCCUPIED";
    }>;

const updateOrder = async (
  businessId: string,
  orderId: string,
  data: UpdateOrderData,
): Promise<UpdateOrderResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<CurrentOrderRow[]>(
      `
        SELECT
          status,
          service_type AS serviceType,
          CAST(restaurant_table_id AS CHAR) AS restaurantTableId,
          customer_count AS customerCount,
          notes
        FROM orders
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    const currentOrder = orderRows[0];

    if (!currentOrder) {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_FOUND",
      };
    }

    if (currentOrder.status !== "OPEN") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_OPEN",
      };
    }

    const serviceType = data.serviceType ?? currentOrder.serviceType;

    let restaurantTableId = currentOrder.restaurantTableId;

    if (data.serviceType !== undefined) {
      restaurantTableId =
        data.serviceType === "TABLE" ? (data.restaurantTableId ?? null) : null;
    }

    if (data.serviceType === "TABLE") {
      if (!restaurantTableId) {
        throw new Error("Una orden de mesa requiere restaurantTableId");
      }

      const [tableRows] = await connection.execute<RestaurantTableStateRow[]>(
        `
            SELECT is_active AS isActive
            FROM restaurant_tables
            WHERE
              business_id = ?
              AND id = ?
            LIMIT 1
            FOR UPDATE
          `,
        [businessId, restaurantTableId],
      );

      const restaurantTable = tableRows[0];

      if (!restaurantTable) {
        await connection.rollback();

        return {
          kind: "TABLE_NOT_FOUND",
        };
      }

      if (!restaurantTable.isActive) {
        await connection.rollback();

        return {
          kind: "TABLE_INACTIVE",
        };
      }

      const [activeOrderRows] = await connection.execute<ActiveOrderRow[]>(
        `
            SELECT CAST(id AS CHAR) AS id
            FROM orders
            WHERE
              business_id = ?
              AND restaurant_table_id = ?
              AND id <> ?
              AND status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED'
              )
            LIMIT 1
          `,
        [businessId, restaurantTableId, orderId],
      );

      if (activeOrderRows[0]) {
        await connection.rollback();

        return {
          kind: "TABLE_OCCUPIED",
        };
      }
    }

    const customerCount =
      data.customerCount === undefined
        ? currentOrder.customerCount
        : data.customerCount;

    const notes = data.notes === undefined ? currentOrder.notes : data.notes;

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          service_type = ?,
          restaurant_table_id = ?,
          customer_count = ?,
          notes = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        serviceType,
        restaurantTableId,
        customerCount,
        notes,
        businessId,
        orderId,
      ],
    );

    await connection.commit();

    return {
      kind: "UPDATED",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { updateOrder };
export type { UpdateOrderResult };
