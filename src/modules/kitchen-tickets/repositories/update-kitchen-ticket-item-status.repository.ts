import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderStatus } from "../../orders/order.types";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type {
  KitchenPreparationStatus,
  KitchenProgressStatus,
  KitchenTicketItem,
} from "../kitchen-ticket.types";

type KitchenTicketItemContextRow = RowDataPacket & {
  orderId: string;
};

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
};

type KitchenTicketItemStateRow = RowDataPacket & {
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

type UpdateKitchenTicketItemStatusResult =
  | Readonly<{
      kind: "UPDATED";
      item: KitchenTicketItem;
      orderDelivered: boolean;
    }>
  | Readonly<{
      kind: "ITEM_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_CONFIRMED";
    }>
  | Readonly<{
      kind: "INVALID_TRANSITION";
    }>;

const nextStatusByCurrentStatus: Record<
  KitchenPreparationStatus,
  KitchenProgressStatus | null
> = {
  PENDING: "IN_PREPARATION",
  IN_PREPARATION: "READY",
  READY: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
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

const updateKitchenTicketItemStatus = async (
  businessId: string,
  membershipId: string,
  kitchenTicketId: string,
  kitchenTicketItemId: string,
  newStatus: KitchenProgressStatus,
): Promise<UpdateKitchenTicketItemStatusResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [contextRows] = await connection.execute<
      KitchenTicketItemContextRow[]
    >(
      `
          SELECT
            CAST(kti.order_id AS CHAR) AS orderId
          FROM kitchen_ticket_items AS kti
          WHERE
            kti.business_id = ?
            AND kti.kitchen_ticket_id = ?
            AND kti.id = ?
          LIMIT 1
        `,
      [businessId, kitchenTicketId, kitchenTicketItemId],
    );

    const itemContext = contextRows[0];

    if (!itemContext) {
      await connection.rollback();

      return {
        kind: "ITEM_NOT_FOUND",
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
      [businessId, itemContext.orderId],
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
      kti.preparation_status AS preparationStatus,
      oi.fulfillment_mode AS fulfillmentMode
    FROM kitchen_ticket_items AS kti
    INNER JOIN order_items AS oi
      ON oi.business_id = kti.business_id
      AND oi.id = kti.order_item_id
    WHERE
      kti.business_id = ?
      AND kti.kitchen_ticket_id = ?
      AND kti.id = ?
    LIMIT 1
    FOR UPDATE
  `,
      [businessId, kitchenTicketId, kitchenTicketItemId],
    );

    const currentItem = itemStateRows[0];

    if (!currentItem) {
      await connection.rollback();

      return {
        kind: "ITEM_NOT_FOUND",
      };
    }

    const expectedNextStatus =
      currentItem.fulfillmentMode === "READY_TO_SERVE"
        ? currentItem.preparationStatus === "READY"
          ? "DELIVERED"
          : null
        : nextStatusByCurrentStatus[currentItem.preparationStatus];

    if (expectedNextStatus !== newStatus) {
      await connection.rollback();

      return {
        kind: "INVALID_TRANSITION",
      };
    }

    const timestampColumn = timestampColumnByStatus[newStatus];

    await connection.execute<ResultSetHeader>(
      `
        UPDATE kitchen_ticket_items
        SET
          preparation_status = ?,
          ${timestampColumn} = CURRENT_TIMESTAMP(3),
          last_changed_by_membership_id = ?
        WHERE
          business_id = ?
          AND kitchen_ticket_id = ?
          AND id = ?
      `,
      [
        newStatus,
        membershipId,
        businessId,
        kitchenTicketId,
        kitchenTicketItemId,
      ],
    );

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
        VALUES (?, ?, ?, ?, ?, NULL)
      `,
      [
        businessId,
        kitchenTicketItemId,
        membershipId,
        currentItem.preparationStatus,
        newStatus,
      ],
    );

    let orderDelivered = false;

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
        [businessId, itemContext.orderId],
      );

      const remainingItems = Number(remainingRows[0]?.total ?? 0);

      if (remainingItems === 0) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE orders
            SET
              status = 'DELIVERED',
              delivered_at = CURRENT_TIMESTAMP(3)
            WHERE
              business_id = ?
              AND id = ?
              AND status = 'CONFIRMED'
          `,
          [businessId, itemContext.orderId],
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
          [businessId, itemContext.orderId, membershipId],
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
            AND kti.id = ?
          LIMIT 1
        `,
      [businessId, kitchenTicketId, kitchenTicketItemId],
    );

    const updatedItem = updatedItemRows[0];

    if (!updatedItem) {
      throw new Error("No fue posible recuperar el producto actualizado");
    }

    await connection.commit();

    return {
      kind: "UPDATED",
      item: mapKitchenTicketItemRow(updatedItem),
      orderDelivered,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { updateKitchenTicketItemStatus };

export type { UpdateKitchenTicketItemStatusResult };
