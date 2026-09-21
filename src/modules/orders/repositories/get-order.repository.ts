import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type {
  OrderDetail,
  OrderItemDetail,
  OrderItemStatus,
  OrderServiceType,
  OrderStatus,
} from "../order.types";

type OrderDetailRow = RowDataPacket & {
  id: string;
  businessId: string;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: OrderServiceType;
  status: OrderStatus;
  customerCount: number | null;
  notes: string | null;
  subtotal: string;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrderItemDetailRow = RowDataPacket & {
  id: string;
  businessId: string;
  orderId: string;
  productId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  addedByMembershipId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
  status: OrderItemStatus;
  cancelledByMembershipId: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const mapOrderItemDetailRow = (row: OrderItemDetailRow): OrderItemDetail => ({
  id: row.id,
  businessId: row.businessId,
  orderId: row.orderId,
  productId: row.productId,
  preparationAreaId: row.preparationAreaId,
  fulfillmentMode: row.fulfillmentMode,
  addedByMembershipId: row.addedByMembershipId,
  productName: row.productName,
  quantity: row.quantity,
  unitPrice: row.unitPrice,
  lineTotal: row.lineTotal,
  notes: row.notes,
  status: row.status,
  cancelledByMembershipId: row.cancelledByMembershipId,
  cancellationReason: row.cancellationReason,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findOrderDetailById = async (
  businessId: string,
  orderId: string,
): Promise<OrderDetail | null> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<OrderDetailRow[]>(
      `
        SELECT
          CAST(o.id AS CHAR) AS id,
          CAST(o.business_id AS CHAR) AS businessId,
          CAST(o.restaurant_table_id AS CHAR) AS restaurantTableId,
          CAST(o.opened_by_membership_id AS CHAR)
            AS openedByMembershipId,
          o.service_type AS serviceType,
          o.status,
          o.customer_count AS customerCount,
          o.notes,
          CAST(
            COALESCE(
              (
                SELECT SUM(oi.quantity * oi.unit_price)
                FROM order_items AS oi
                WHERE
                  oi.business_id = o.business_id
                  AND oi.order_id = o.id
                  AND oi.status = 'ACTIVE'
              ),
              0.00
            )
            AS CHAR
          ) AS subtotal,
          o.confirmed_at AS confirmedAt,
          o.delivered_at AS deliveredAt,
          o.closed_at AS closedAt,
          o.cancelled_at AS cancelledAt,
          o.created_at AS createdAt,
          o.updated_at AS updatedAt
        FROM orders AS o
        WHERE
          o.business_id = ?
          AND o.id = ?
        LIMIT 1
      `,
      [businessId, orderId],
    );

    const order = orderRows[0];

    if (!order) {
      await connection.commit();
      return null;
    }

    const [orderItemRows] = await connection.execute<OrderItemDetailRow[]>(
      `
          SELECT
            CAST(oi.id AS CHAR) AS id,
            CAST(oi.business_id AS CHAR) AS businessId,
            CAST(oi.order_id AS CHAR) AS orderId,
            CAST(oi.product_id AS CHAR) AS productId,
            CAST(oi.preparation_area_id AS CHAR) AS preparationAreaId,
            oi.fulfillment_mode AS fulfillmentMode,
            CAST(oi.added_by_membership_id AS CHAR)
              AS addedByMembershipId,
            oi.product_name AS productName,
            oi.quantity,
            CAST(oi.unit_price AS CHAR) AS unitPrice,
            CAST(oi.quantity * oi.unit_price AS CHAR) AS lineTotal,
            oi.notes,
            oi.status,
            CAST(oi.cancelled_by_membership_id AS CHAR)
              AS cancelledByMembershipId,
            oi.cancellation_reason AS cancellationReason,
            oi.cancelled_at AS cancelledAt,
            oi.created_at AS createdAt,
            oi.updated_at AS updatedAt
          FROM order_items AS oi
          WHERE
            oi.business_id = ?
            AND oi.order_id = ?
          ORDER BY
            oi.created_at ASC,
            oi.id ASC
        `,
      [businessId, orderId],
    );

    await connection.commit();

    return {
      id: order.id,
      businessId: order.businessId,
      restaurantTableId: order.restaurantTableId,
      openedByMembershipId: order.openedByMembershipId,
      serviceType: order.serviceType,
      status: order.status,
      customerCount: order.customerCount,
      notes: order.notes,
      subtotal: order.subtotal,
      confirmedAt: order.confirmedAt,
      deliveredAt: order.deliveredAt,
      closedAt: order.closedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: orderItemRows.map(mapOrderItemDetailRow),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { findOrderDetailById };
