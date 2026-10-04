import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ProductFulfillmentMode } from "../../products/product.types";
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

type AvailableProductRow = RowDataPacket & {
  id: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  name: string;
  currentPrice: string;
  isAvailable: number;
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
    }>
  | Readonly<{
      kind: "PRODUCT_NOT_FOUND";
    }>
  | Readonly<{
      kind: "PRODUCT_UNAVAILABLE";
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

    const productIds = [...new Set(data.items.map((item) => item.productId))];

    const productPlaceholders = productIds.map(() => "?").join(", ");

    const [productRows] = await connection.execute<AvailableProductRow[]>(
      `
        SELECT
          CAST(p.id AS CHAR) AS id,
          CAST(p.preparation_area_id AS CHAR)
            AS preparationAreaId,
          p.fulfillment_mode AS fulfillmentMode,
          p.name,
          CAST(p.current_price AS CHAR)
            AS currentPrice,
          (
            p.is_active = TRUE
            AND c.is_active = TRUE
            AND pa.is_active = TRUE
          ) AS isAvailable
        FROM products AS p
        INNER JOIN categories AS c
          ON c.business_id = p.business_id
          AND c.id = p.category_id
        INNER JOIN preparation_areas AS pa
          ON pa.business_id = p.business_id
          AND pa.id = p.preparation_area_id
        WHERE
          p.business_id = ?
          AND p.id IN (${productPlaceholders})
        FOR SHARE
      `,
      [businessId, ...productIds],
    );

    const productsById = new Map(
      productRows.map((product) => [product.id, product]),
    );

    for (const item of data.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        await connection.rollback();

        return {
          kind: "PRODUCT_NOT_FOUND",
        };
      }

      if (!product.isAvailable) {
        await connection.rollback();

        return {
          kind: "PRODUCT_UNAVAILABLE",
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

    for (const item of data.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new Error(
          "No fue posible recuperar un producto previamente validado",
        );
      }

      const [orderItemInsertResult] = await connection.execute<ResultSetHeader>(
        `
            INSERT INTO order_items (
              business_id,
              order_id,
              product_id,
              preparation_area_id,
              fulfillment_mode,
              added_by_membership_id,
              product_name,
              quantity,
              unit_price,
              notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        [
          businessId,
          orderId,
          product.id,
          product.preparationAreaId,
          product.fulfillmentMode,
          data.openedByMembershipId,
          product.name,
          item.quantity,
          product.currentPrice,
          item.notes,
        ],
      );

      const orderItemId = orderItemInsertResult.insertId.toString();

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
            'ADDED',
            NULL,
            ?,
            NULL,
            ?,
            NULL
          )
        `,
        [
          businessId,
          orderItemId,
          data.openedByMembershipId,
          item.quantity,
          item.notes,
        ],
      );
    }

    const [orderRows] = await connection.execute<OrderRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          CAST(business_id AS CHAR) AS businessId,
          CAST(restaurant_table_id AS CHAR)
            AS restaurantTableId,
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
