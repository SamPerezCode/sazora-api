import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type {
  AddOrderItemsData,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
} from "../order.types";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type AvailableProductRow = RowDataPacket & {
  id: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  name: string;
  currentPrice: string;
  isAvailable: number;
};

type OrderItemRow = RowDataPacket & {
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
  notes: string | null;
  status: OrderItemStatus;
  cancelledByMembershipId: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type KitchenTicketRow = RowDataPacket & {
  id: string;
  currentVersion: number;
};

type CreatedOrderItemContext = Readonly<{
  orderItemId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  quantity: number;
  notes: string | null;
}>;

type AddOrderItemsResult =
  | Readonly<{
      kind: "CREATED";
      orderItems: OrderItem[];
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_EDITABLE";
    }>
  | Readonly<{
      kind: "PRODUCT_NOT_FOUND";
    }>
  | Readonly<{
      kind: "PRODUCT_UNAVAILABLE";
    }>;

const mapOrderItemRow = (row: OrderItemRow): OrderItem => ({
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
  notes: row.notes,
  status: row.status,
  cancelledByMembershipId: row.cancelledByMembershipId,
  cancellationReason: row.cancellationReason,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const addOrderItems = async (
  businessId: string,
  orderId: string,
  data: AddOrderItemsData,
): Promise<AddOrderItemsResult> => {
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
        kind: "ORDER_NOT_EDITABLE",
      };
    }

    const productIds = [...new Set(data.items.map((item) => item.productId))];
    const productPlaceholders = productIds.map(() => "?").join(", ");

    const [productRows] = await connection.execute<AvailableProductRow[]>(
      `
        SELECT
          CAST(p.id AS CHAR) AS id,
          CAST(p.preparation_area_id AS CHAR) AS preparationAreaId,
          p.fulfillment_mode AS fulfillmentMode,
          p.name,
          CAST(p.current_price AS CHAR) AS currentPrice,
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

    const createdItemContexts: CreatedOrderItemContext[] = [];

    for (const item of data.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new Error(
          "No fue posible recuperar un producto previamente validado",
        );
      }

      const [insertResult] = await connection.execute<ResultSetHeader>(
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
          data.addedByMembershipId,
          product.name,
          item.quantity,
          product.currentPrice,
          item.notes,
        ],
      );

      const orderItemId = insertResult.insertId.toString();

      createdItemContexts.push({
        orderItemId,
        preparationAreaId: product.preparationAreaId,
        fulfillmentMode: product.fulfillmentMode,
        quantity: item.quantity,
        notes: item.notes,
      });

      if (order.status === "CONFIRMED") {
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
            data.addedByMembershipId,
            item.quantity,
            item.notes,
          ],
        );
      }
    }

    if (order.status === "CONFIRMED") {
      const itemsByPreparationArea = new Map<
        string,
        CreatedOrderItemContext[]
      >();

      for (const item of createdItemContexts) {
        const currentItems =
          itemsByPreparationArea.get(item.preparationAreaId) ?? [];

        currentItems.push(item);

        itemsByPreparationArea.set(item.preparationAreaId, currentItems);
      }

      for (const [preparationAreaId, areaItems] of itemsByPreparationArea) {
        const [ticketRows] = await connection.execute<KitchenTicketRow[]>(
          `
            SELECT
              CAST(id AS CHAR) AS id,
              current_version AS currentVersion
            FROM kitchen_tickets
            WHERE
              business_id = ?
              AND order_id = ?
              AND preparation_area_id = ?
            LIMIT 1
            FOR UPDATE
          `,
          [businessId, orderId, preparationAreaId],
        );

        const currentTicket = ticketRows[0];

        let kitchenTicketId: string;

        if (currentTicket) {
          kitchenTicketId = currentTicket.id;

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
            [data.addedByMembershipId, businessId, kitchenTicketId],
          );
        } else {
          const [ticketInsertResult] =
            await connection.execute<ResultSetHeader>(
              `
                INSERT INTO kitchen_tickets (
                  business_id,
                  order_id,
                  preparation_area_id,
                  created_by_membership_id,
                  last_modified_by_membership_id
                )
                VALUES (?, ?, ?, ?, ?)
              `,
              [
                businessId,
                orderId,
                preparationAreaId,
                data.addedByMembershipId,
                data.addedByMembershipId,
              ],
            );

          kitchenTicketId = ticketInsertResult.insertId.toString();
        }

        for (const areaItem of areaItems) {
          const initialStatus: KitchenPreparationStatus =
            areaItem.fulfillmentMode === "READY_TO_SERVE" ? "READY" : "PENDING";

          const [ticketItemInsertResult] =
            await connection.execute<ResultSetHeader>(
              `
                INSERT INTO kitchen_ticket_items (
                  business_id,
                  kitchen_ticket_id,
                  order_item_id,
                  order_id,
                  preparation_area_id,
                  preparation_status,
                  last_changed_by_membership_id,
                  ready_at
                )
                VALUES (
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  CASE
                    WHEN ? = 'READY'
                      THEN CURRENT_TIMESTAMP(3)
                    ELSE NULL
                  END
                )
              `,
              [
                businessId,
                kitchenTicketId,
                areaItem.orderItemId,
                orderId,
                preparationAreaId,
                initialStatus,
                data.addedByMembershipId,
                initialStatus,
              ],
            );

          const kitchenTicketItemId =
            ticketItemInsertResult.insertId.toString();

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
              VALUES (?, ?, ?, NULL, ?, NULL)
            `,
            [
              businessId,
              kitchenTicketItemId,
              data.addedByMembershipId,
              initialStatus,
            ],
          );
        }
      }
    }

    const orderItemIds = createdItemContexts.map((item) => item.orderItemId);

    const orderItemPlaceholders = orderItemIds.map(() => "?").join(", ");

    const [orderItemRows] = await connection.execute<OrderItemRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          CAST(business_id AS CHAR) AS businessId,
          CAST(order_id AS CHAR) AS orderId,
          CAST(product_id AS CHAR) AS productId,
          CAST(preparation_area_id AS CHAR) AS preparationAreaId,
          fulfillment_mode AS fulfillmentMode,
          CAST(added_by_membership_id AS CHAR) AS addedByMembershipId,
          product_name AS productName,
          quantity,
          CAST(unit_price AS CHAR) AS unitPrice,
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
          AND id IN (${orderItemPlaceholders})
      `,
      [businessId, orderId, ...orderItemIds],
    );

    const orderItemsById = new Map(
      orderItemRows.map((row) => [row.id, mapOrderItemRow(row)]),
    );

    const createdOrderItems = orderItemIds.map((orderItemId) => {
      const orderItem = orderItemsById.get(orderItemId);

      if (!orderItem) {
        throw new Error(
          "No fue posible recuperar un producto agregado a la orden",
        );
      }

      return orderItem;
    });

    await connection.commit();

    return {
      kind: "CREATED",
      orderItems: createdOrderItems,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { addOrderItems };
export type { AddOrderItemsResult };
