import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenWorkflowMode } from "../../kitchen-settings/kitchen-settings.types";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import type { OrderStatus } from "../order.types";

type OrderStateRow = RowDataPacket & {
  status: OrderStatus;
  kitchenWorkflowMode: KitchenWorkflowMode | null;
};

type DeliverableItemRow = RowDataPacket & {
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  previousStatus: KitchenPreparationStatus;
};

type DeliverPrintOnlyOrderResult =
  | Readonly<{
      kind: "DELIVERED";
      deliveredAt: Date;
      items: readonly DeliverableItemRow[];
    }>
  | Readonly<{ kind: "ORDER_NOT_FOUND" }>
  | Readonly<{
      kind: "ORDER_NOT_CONFIRMED";
      currentStatus: OrderStatus;
    }>
  | Readonly<{
      kind: "ORDER_REQUIRES_KITCHEN_SCREEN";
    }>
  | Readonly<{
      kind: "ORDER_HAS_NO_DELIVERABLE_ITEMS";
    }>;

const deliverPrintOnlyOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
): Promise<DeliverPrintOnlyOrderResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<OrderStateRow[]>(
      `
        SELECT
          status,
          kitchen_workflow_mode AS kitchenWorkflowMode
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
      return { kind: "ORDER_NOT_FOUND" };
    }

    if (order.status !== "CONFIRMED") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_CONFIRMED",
        currentStatus: order.status,
      };
    }

    if (order.kitchenWorkflowMode !== "PRINT_ONLY") {
      await connection.rollback();

      return {
        kind: "ORDER_REQUIRES_KITCHEN_SCREEN",
      };
    }

    const [itemRows] = await connection.execute<DeliverableItemRow[]>(
      `
        SELECT
          CAST(kti.kitchen_ticket_id AS CHAR)
            AS kitchenTicketId,
          CAST(kti.id AS CHAR)
            AS kitchenTicketItemId,
          kti.preparation_status AS previousStatus
        FROM kitchen_ticket_items AS kti
        INNER JOIN order_items AS oi
          ON oi.business_id = kti.business_id
          AND oi.id = kti.order_item_id
        WHERE
          kti.business_id = ?
          AND kti.order_id = ?
          AND oi.status = 'ACTIVE'
          AND kti.preparation_status <> 'CANCELLED'
        ORDER BY kti.id
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    if (itemRows.length === 0) {
      await connection.rollback();

      return {
        kind: "ORDER_HAS_NO_DELIVERABLE_ITEMS",
      };
    }

    const itemsToChange = itemRows.filter(
      (item) => item.previousStatus !== "DELIVERED",
    );

    const deliveredAt = new Date();

    if (itemsToChange.length > 0) {
      const itemIds = itemsToChange.map((item) => item.kitchenTicketItemId);
      const placeholders = itemIds.map(() => "?").join(", ");

      await connection.execute<ResultSetHeader>(
        `
          UPDATE kitchen_ticket_items
          SET
            preparation_status = 'DELIVERED',
            started_at = COALESCE(started_at, ?),
            ready_at = COALESCE(ready_at, ?),
            delivered_at = ?,
            last_changed_by_membership_id = ?
          WHERE
            business_id = ?
            AND id IN (${placeholders})
        `,
        [
          deliveredAt,
          deliveredAt,
          deliveredAt,
          membershipId,
          businessId,
          ...itemIds,
        ],
      );

      const historyPlaceholders = itemsToChange
        .map(() => "(?, ?, ?, ?, 'DELIVERED', ?)")
        .join(", ");

      const historyValues: string[] = [];

      for (const item of itemsToChange) {
        historyValues.push(
          businessId,
          item.kitchenTicketItemId,
          membershipId,
          item.previousStatus,
          "Entrega directa en modo de comandas impresas",
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
    }

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
      [deliveredAt, businessId, orderId],
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
          'Entrega directa en modo de comandas impresas'
        )
      `,
      [businessId, orderId, membershipId],
    );

    await connection.commit();

    return {
      kind: "DELIVERED",
      deliveredAt,
      items: itemsToChange,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { deliverPrintOnlyOrder };
export type { DeliverPrintOnlyOrderResult };
