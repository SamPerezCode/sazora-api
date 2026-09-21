import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type {
  OrderItemDetail,
  OrderItemStatus,
  OrderStatus,
  UpdateOrderItemData,
} from "../order.types";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type CurrentOrderItemRow = RowDataPacket & {
  quantity: number;
  notes: string | null;
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

type UpdateOrderItemResult =
  | Readonly<{
      kind: "UPDATED";
      orderItem: OrderItemDetail;
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

const updateOrderItem = async (
  businessId: string,
  orderId: string,
  orderItemId: string,
  data: UpdateOrderItemData,
): Promise<UpdateOrderItemResult> => {
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

    const [currentOrderItemRows] = await connection.execute<
      CurrentOrderItemRow[]
    >(
      `
          SELECT
            quantity,
            notes
          FROM order_items
          WHERE
            business_id = ?
            AND order_id = ?
            AND id = ?
            AND status = 'ACTIVE'
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, orderId, orderItemId],
    );

    const currentOrderItem = currentOrderItemRows[0];

    if (!currentOrderItem) {
      await connection.rollback();

      return {
        kind: "ORDER_ITEM_NOT_FOUND",
      };
    }

    const quantity = data.quantity ?? currentOrderItem.quantity;

    const notes =
      data.notes === undefined ? currentOrderItem.notes : data.notes;

    await connection.execute<ResultSetHeader>(
      `
        UPDATE order_items
        SET
          quantity = ?,
          notes = ?
        WHERE
          business_id = ?
          AND order_id = ?
          AND id = ?
      `,
      [quantity, notes, businessId, orderId, orderItemId],
    );

    const [updatedOrderItemRows] = await connection.execute<
      OrderItemDetailRow[]
    >(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            CAST(business_id AS CHAR) AS businessId,
            CAST(order_id AS CHAR) AS orderId,
            CAST(product_id AS CHAR) AS productId,
            CAST(preparation_area_id AS CHAR) AS preparationAreaId,
            fulfillment_mode AS fulfillmentMode,
            CAST(added_by_membership_id AS CHAR)
              AS addedByMembershipId,
            product_name AS productName,
            quantity,
            CAST(unit_price AS CHAR) AS unitPrice,
            CAST(quantity * unit_price AS CHAR) AS lineTotal,
            notes,
            status,
            CAST(cancelled_by_membership_id AS CHAR)
              AS cancelledByMembershipId,
            cancellation_reason AS cancellationReason,
            cancelled_at AS cancelledAt,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM order_items
          WHERE
            business_id = ?
            AND order_id = ?
            AND id = ?
          LIMIT 1
        `,
      [businessId, orderId, orderItemId],
    );

    const updatedOrderItem = updatedOrderItemRows[0];

    if (!updatedOrderItem) {
      throw new Error("No fue posible recuperar el producto actualizado");
    }

    await connection.commit();

    return {
      kind: "UPDATED",
      orderItem: mapOrderItemDetailRow(updatedOrderItem),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { updateOrderItem };
export type { UpdateOrderItemResult };
