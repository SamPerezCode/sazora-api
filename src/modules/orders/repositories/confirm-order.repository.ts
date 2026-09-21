import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import type { OrderStatus } from "../order.types";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type OrderItemToConfirmRow = RowDataPacket & {
  id: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  preparationAreaIsActive: number;
};

type CreatedKitchenTicket = Readonly<{
  id: string;
  preparationAreaId: string;
  currentVersion: number;
  orderItemIds: readonly string[];
}>;

type ConfirmOrderResult =
  | Readonly<{
      kind: "CONFIRMED";
      kitchenTickets: readonly CreatedKitchenTicket[];
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_OPEN";
    }>
  | Readonly<{
      kind: "ORDER_HAS_NO_ITEMS";
    }>
  | Readonly<{
      kind: "PREPARATION_AREA_INACTIVE";
    }>;

const confirmOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
): Promise<ConfirmOrderResult> => {
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

    const [orderItemRows] = await connection.execute<OrderItemToConfirmRow[]>(
      `
        SELECT
          CAST(oi.id AS CHAR) AS id,
          CAST(oi.preparation_area_id AS CHAR)
            AS preparationAreaId,
          oi.fulfillment_mode AS fulfillmentMode,
          pa.is_active AS preparationAreaIsActive
        FROM order_items AS oi
        INNER JOIN preparation_areas AS pa
          ON pa.business_id = oi.business_id
          AND pa.id = oi.preparation_area_id
        WHERE
          oi.business_id = ?
          AND oi.order_id = ?
          AND oi.status = 'ACTIVE'
        ORDER BY oi.id ASC
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    if (orderItemRows.length === 0) {
      await connection.rollback();

      return {
        kind: "ORDER_HAS_NO_ITEMS",
      };
    }

    if (orderItemRows.some((orderItem) => !orderItem.preparationAreaIsActive)) {
      await connection.rollback();

      return {
        kind: "PREPARATION_AREA_INACTIVE",
      };
    }

    const itemsByPreparationArea = new Map<string, OrderItemToConfirmRow[]>();

    for (const orderItem of orderItemRows) {
      const currentItems =
        itemsByPreparationArea.get(orderItem.preparationAreaId) ?? [];

      currentItems.push(orderItem);

      itemsByPreparationArea.set(orderItem.preparationAreaId, currentItems);
    }

    const kitchenTickets: CreatedKitchenTicket[] = [];

    for (const [preparationAreaId, orderItems] of itemsByPreparationArea) {
      const [ticketInsertResult] = await connection.execute<ResultSetHeader>(
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
        [businessId, orderId, preparationAreaId, membershipId, membershipId],
      );

      const kitchenTicketId = ticketInsertResult.insertId.toString();

      for (const orderItem of orderItems) {
        const initialStatus: KitchenPreparationStatus =
          orderItem.fulfillmentMode === "READY_TO_SERVE" ? "READY" : "PENDING";

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
              orderItem.id,
              orderId,
              preparationAreaId,
              initialStatus,
              membershipId,
              initialStatus,
            ],
          );

        const kitchenTicketItemId = ticketItemInsertResult.insertId.toString();

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
          [businessId, kitchenTicketItemId, membershipId, initialStatus],
        );
      }

      kitchenTickets.push({
        id: kitchenTicketId,
        preparationAreaId,
        currentVersion: 1,
        orderItemIds: orderItems.map((orderItem) => orderItem.id),
      });
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          status = 'CONFIRMED',
          confirmed_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
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
        VALUES (?, ?, ?, 'OPEN', 'CONFIRMED', NULL)
      `,
      [businessId, orderId, membershipId],
    );

    await connection.commit();

    return {
      kind: "CONFIRMED",
      kitchenTickets,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { confirmOrder };

export type { ConfirmOrderResult, CreatedKitchenTicket };
