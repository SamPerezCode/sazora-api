import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderStatus } from "../../orders/order.types";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type {
  KitchenPreparationStatus,
  KitchenProgressStatus,
  KitchenTicketItem,
} from "../kitchen-ticket.types";

type KitchenTicketContextRow = RowDataPacket & {
  orderId: string;
};

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type KitchenTicketItemStateRow = RowDataPacket & {
  id: string;
  preparationStatus: KitchenPreparationStatus;
  fulfillmentMode: ProductFulfillmentMode;
};

type RemainingKitchenItemsRow = RowDataPacket & {
  total: string;
};

type KitchenTicketItemRow = RowDataPacket & {
  id: string;
  orderItemId: string;
  productName: string;
  fulfillmentMode: ProductFulfillmentMode;
  quantity: number;
  notes: string | null;
  preparationStatus: KitchenPreparationStatus;
  startedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type UpdateKitchenTicketStatusResult =
  | Readonly<{
      kind: "UPDATED";
      orderId: string;
      items: readonly KitchenTicketItem[];
      orderDelivered: boolean;
      orderDeliveredAt: Date | null;
    }>
  | Readonly<{
      kind: "TICKET_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_CONFIRMED";
    }>
  | Readonly<{
      kind: "INVALID_TRANSITION";
    }>;

const previousStatusByNewStatus: Record<
  KitchenProgressStatus,
  KitchenPreparationStatus
> = {
  IN_PREPARATION: "PENDING",
  READY: "IN_PREPARATION",
  DELIVERED: "READY",
};

const timestampColumnByStatus: Record<
  KitchenProgressStatus,
  "started_at" | "ready_at" | "delivered_at"
> = {
  IN_PREPARATION: "started_at",
  READY: "ready_at",
  DELIVERED: "delivered_at",
};

const mapKitchenTicketItemRow = (
  row: KitchenTicketItemRow,
): KitchenTicketItem => ({
  id: row.id,
  orderItemId: row.orderItemId,
  productName: row.productName,
  fulfillmentMode: row.fulfillmentMode,
  quantity: row.quantity,
  notes: row.notes,
  preparationStatus: row.preparationStatus,
  startedAt: row.startedAt,
  readyAt: row.readyAt,
  deliveredAt: row.deliveredAt,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const selectItemsToUpdate = (
  items: readonly KitchenTicketItemStateRow[],
  newStatus: KitchenProgressStatus,
): KitchenTicketItemStateRow[] => {
  const activeItems = items.filter(
    (item) =>
      item.preparationStatus !== "DELIVERED" &&
      item.preparationStatus !== "CANCELLED",
  );

  if (newStatus === "IN_PREPARATION") {
    return activeItems.filter(
      (item) =>
        item.fulfillmentMode === "PREPARE_TO_ORDER" &&
        item.preparationStatus === "PENDING",
    );
  }

  if (newStatus === "READY") {
    const hasPendingItems = activeItems.some(
      (item) => item.preparationStatus === "PENDING",
    );

    if (hasPendingItems) {
      return [];
    }

    return activeItems.filter(
      (item) => item.preparationStatus === "IN_PREPARATION",
    );
  }

  const allActiveItemsAreReady =
    activeItems.length > 0 &&
    activeItems.every((item) => item.preparationStatus === "READY");

  if (!allActiveItemsAreReady) {
    return [];
  }

  return activeItems;
};

const updateKitchenTicketStatus = async (
  businessId: string,
  membershipId: string,
  kitchenTicketId: string,
  newStatus: KitchenProgressStatus,
): Promise<UpdateKitchenTicketStatusResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [ticketRows] = await connection.execute<KitchenTicketContextRow[]>(
      `
        SELECT
          CAST(order_id AS CHAR) AS orderId
        FROM kitchen_tickets
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
      `,
      [businessId, kitchenTicketId],
    );

    const ticket = ticketRows[0];

    if (!ticket) {
      await connection.rollback();

      return {
        kind: "TICKET_NOT_FOUND",
      };
    }

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
      [businessId, ticket.orderId],
    );

    const order = orderRows[0];

    if (order?.status !== "CONFIRMED") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_CONFIRMED",
      };
    }

    const [itemStateRows] = await connection.execute<
      KitchenTicketItemStateRow[]
    >(
      `
        SELECT
          CAST(kti.id AS CHAR) AS id,
          kti.preparation_status AS preparationStatus,
          oi.fulfillment_mode AS fulfillmentMode
        FROM kitchen_ticket_items AS kti
        INNER JOIN order_items AS oi
          ON oi.business_id = kti.business_id
          AND oi.id = kti.order_item_id
        WHERE
          kti.business_id = ?
          AND kti.kitchen_ticket_id = ?
        ORDER BY
          kti.created_at ASC,
          kti.id ASC
        FOR UPDATE
      `,
      [businessId, kitchenTicketId],
    );

    const itemsToUpdate = selectItemsToUpdate(itemStateRows, newStatus);

    if (itemsToUpdate.length === 0) {
      await connection.rollback();

      return {
        kind: "INVALID_TRANSITION",
      };
    }

    const changedAt = new Date();
    const timestampColumn = timestampColumnByStatus[newStatus];
    const previousStatus = previousStatusByNewStatus[newStatus];
    const itemIds = itemsToUpdate.map((item) => item.id);
    const itemPlaceholders = itemIds.map(() => "?").join(", ");

    await connection.execute<ResultSetHeader>(
      `
        UPDATE kitchen_ticket_items
        SET
          preparation_status = ?,
          ${timestampColumn} = ?,
          last_changed_by_membership_id = ?
        WHERE
          business_id = ?
          AND kitchen_ticket_id = ?
          AND id IN (${itemPlaceholders})
      `,
      [
        newStatus,
        changedAt,
        membershipId,
        businessId,
        kitchenTicketId,
        ...itemIds,
      ],
    );

    const historyPlaceholders = itemsToUpdate
      .map(() => "(?, ?, ?, ?, ?, NULL)")
      .join(", ");

    const historyValues: string[] = [];

    for (const item of itemsToUpdate) {
      historyValues.push(
        businessId,
        item.id,
        membershipId,
        previousStatus,
        newStatus,
      );
    }

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
        VALUES ${historyPlaceholders}
      `,
      historyValues,
    );

    let orderDelivered = false;
    let orderDeliveredAt: Date | null = null;

    if (newStatus === "DELIVERED") {
      const [remainingRows] = await connection.execute<
        RemainingKitchenItemsRow[]
      >(
        `
          SELECT CAST(COUNT(*) AS CHAR) AS total
          FROM kitchen_ticket_items
          WHERE
            business_id = ?
            AND order_id = ?
            AND preparation_status NOT IN (
              'DELIVERED',
              'CANCELLED'
            )
        `,
        [businessId, ticket.orderId],
      );

      const remainingItems = Number(remainingRows[0]?.total ?? 0);

      if (remainingItems === 0) {
        orderDeliveredAt = changedAt;

        await connection.execute<ResultSetHeader>(
          `
            UPDATE orders
            SET
              status = 'DELIVERED',
              delivered_at = ?
            WHERE
              business_id = ?
              AND id = ?
              AND status = 'CONFIRMED'
          `,
          [orderDeliveredAt, businessId, ticket.orderId],
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
              'CONFIRMED',
              'DELIVERED',
              NULL
            )
          `,
          [businessId, ticket.orderId, membershipId],
        );

        orderDelivered = true;
      }
    }

    const [updatedItemRows] = await connection.execute<KitchenTicketItemRow[]>(
      `
        SELECT
          CAST(kti.id AS CHAR) AS id,
          CAST(kti.order_item_id AS CHAR) AS orderItemId,
          oi.product_name AS productName,
          oi.fulfillment_mode AS fulfillmentMode,
          oi.quantity,
          oi.notes,
          kti.preparation_status AS preparationStatus,
          kti.started_at AS startedAt,
          kti.ready_at AS readyAt,
          kti.delivered_at AS deliveredAt,
          kti.cancelled_at AS cancelledAt,
          kti.created_at AS createdAt,
          kti.updated_at AS updatedAt
        FROM kitchen_ticket_items AS kti
        INNER JOIN order_items AS oi
          ON oi.business_id = kti.business_id
          AND oi.id = kti.order_item_id
        WHERE
          kti.business_id = ?
          AND kti.kitchen_ticket_id = ?
          AND kti.id IN (${itemPlaceholders})
        ORDER BY
          kti.created_at ASC,
          kti.id ASC
      `,
      [businessId, kitchenTicketId, ...itemIds],
    );

    await connection.commit();

    return {
      kind: "UPDATED",
      orderId: ticket.orderId,
      items: updatedItemRows.map(mapKitchenTicketItemRow),
      orderDelivered,
      orderDeliveredAt,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { updateKitchenTicketStatus };

export type { UpdateKitchenTicketStatusResult };
