import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreateOrderData,
  Order,
  OrderServiceType,
  OrderStatus,
} from "../order.types";

type OrderRow = RowDataPacket & {
  id: string;
  businessId: string;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: OrderServiceType;
  status: OrderStatus;
  customerCount: number | null;
  notes: string | null;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type RestaurantTableStateRow = RowDataPacket & {
  isActive: number;
};

type ActiveOrderRow = RowDataPacket & {
  id: string;
};

type CreateOrderResult =
  | Readonly<{
      kind: "CREATED";
      order: Order;
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

const mapOrderRow = (row: OrderRow): Order => ({
  id: row.id,
  businessId: row.businessId,
  restaurantTableId: row.restaurantTableId,
  openedByMembershipId: row.openedByMembershipId,
  serviceType: row.serviceType,
  status: row.status,
  customerCount: row.customerCount,
  notes: row.notes,
  confirmedAt: row.confirmedAt,
  deliveredAt: row.deliveredAt,
  closedAt: row.closedAt,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const createOrder = async (
  businessId: string,
  data: CreateOrderData,
): Promise<CreateOrderResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    if (data.serviceType === "TABLE") {
      const [tableRows] = await connection.execute<RestaurantTableStateRow[]>(
        `
            SELECT
              is_active AS isActive
            FROM restaurant_tables
            WHERE
              business_id = ?
              AND id = ?
            LIMIT 1
            FOR UPDATE
          `,
        [businessId, data.restaurantTableId],
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
            SELECT
              CAST(id AS CHAR) AS id
            FROM orders
            WHERE
              business_id = ?
              AND restaurant_table_id = ?
              AND status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED'
              )
            LIMIT 1
          `,
        [businessId, data.restaurantTableId],
      );

      if (activeOrderRows[0]) {
        await connection.rollback();

        return {
          kind: "TABLE_OCCUPIED",
        };
      }
    }

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO orders (
            business_id,
            restaurant_table_id,
            opened_by_membership_id,
            service_type,
            customer_count,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      [
        businessId,
        data.restaurantTableId,
        data.openedByMembershipId,
        data.serviceType,
        data.customerCount,
        data.notes,
      ],
    );

    const orderId = insertResult.insertId.toString();

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
        VALUES (?, ?, ?, NULL, 'OPEN', NULL)
      `,
      [businessId, orderId, data.openedByMembershipId],
    );

    const [orderRows] = await connection.execute<OrderRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          CAST(business_id AS CHAR) AS businessId,
          CAST(restaurant_table_id AS CHAR) AS restaurantTableId,
          CAST(opened_by_membership_id AS CHAR)
            AS openedByMembershipId,
          service_type AS serviceType,
          status,
          customer_count AS customerCount,
          notes,
          confirmed_at AS confirmedAt,
          delivered_at AS deliveredAt,
          closed_at AS closedAt,
          cancelled_at AS cancelledAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM orders
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
      `,
      [businessId, orderId],
    );

    const createdOrder = orderRows[0];

    if (!createdOrder) {
      throw new Error("No fue posible recuperar la orden creada");
    }

    await connection.commit();

    return {
      kind: "CREATED",
      order: mapOrderRow(createdOrder),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createOrder };
export type { CreateOrderResult };
