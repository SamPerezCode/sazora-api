import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenWorkflowMode } from "../../kitchen-settings/kitchen-settings.types";
import type {
  KitchenTicketPrint,
  KitchenTicketPrintSnapshot,
  KitchenTicketPrintType,
} from "../../kitchen-tickets/kitchen-ticket-print.types";
import type {
  KitchenPreparationStatus,
  KitchenTicketItem,
} from "../../kitchen-tickets/kitchen-ticket.types";
import type { ProductFulfillmentMode } from "../../products/product.types";
import { calculateOrderKitchenTicketStatus } from "../order-kitchen-history.types";
import type {
  OrderKitchenHistory,
  OrderKitchenHistoryTicket,
} from "../order-kitchen-history.types";

type OrderRow = RowDataPacket & {
  id: string;
  kitchenWorkflowMode: KitchenWorkflowMode | null;
};

type KitchenTicketRow = RowDataPacket & {
  id: string;
  preparationAreaId: string;
  preparationAreaName: string;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

type KitchenTicketItemRow = RowDataPacket & {
  id: string;
  kitchenTicketId: string;
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

type KitchenTicketPrintRow = RowDataPacket & {
  id: string;
  businessId: string;
  kitchenTicketId: string;
  printedByMembershipId: string;
  ticketVersion: number;
  printType: KitchenTicketPrintType;
  reason: string | null;
  printerName: string | null;
  contentSnapshot: unknown;
  createdAt: Date;
};

const parseContentSnapshot = (value: unknown): KitchenTicketPrintSnapshot => {
  if (typeof value === "string") {
    return JSON.parse(value) as KitchenTicketPrintSnapshot;
  }

  return value as KitchenTicketPrintSnapshot;
};

const mapPrint = (row: KitchenTicketPrintRow): KitchenTicketPrint => ({
  id: row.id,
  businessId: row.businessId,
  kitchenTicketId: row.kitchenTicketId,
  printedByMembershipId: row.printedByMembershipId,
  ticketVersion: row.ticketVersion,
  printType: row.printType,
  reason: row.reason,
  printerName: row.printerName,
  contentSnapshot: parseContentSnapshot(row.contentSnapshot),
  createdAt: row.createdAt,
});

const findOrder = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
): Promise<OrderRow | null> => {
  const [rows] = await connection.execute<OrderRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        kitchen_workflow_mode AS kitchenWorkflowMode
      FROM orders
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, orderId],
  );

  return rows[0] ?? null;
};

const findTickets = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
): Promise<readonly KitchenTicketRow[]> => {
  const [rows] = await connection.execute<KitchenTicketRow[]>(
    `
      SELECT
        CAST(kt.id AS CHAR) AS id,
        CAST(kt.preparation_area_id AS CHAR) AS preparationAreaId,
        pa.name AS preparationAreaName,
        kt.current_version AS currentVersion,
        kt.created_at AS createdAt,
        kt.updated_at AS updatedAt
      FROM kitchen_tickets AS kt
      INNER JOIN preparation_areas AS pa
        ON pa.business_id = kt.business_id
        AND pa.id = kt.preparation_area_id
      WHERE
        kt.business_id = ?
        AND kt.order_id = ?
      ORDER BY
        kt.created_at ASC,
        kt.id ASC
    `,
    [businessId, orderId],
  );

  return rows;
};

const findTicketItems = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
): Promise<readonly KitchenTicketItemRow[]> => {
  const [rows] = await connection.execute<KitchenTicketItemRow[]>(
    `
      SELECT
        CAST(kti.id AS CHAR) AS id,
        CAST(kti.kitchen_ticket_id AS CHAR) AS kitchenTicketId,
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
        AND kti.order_id = ?
      ORDER BY
        kti.created_at ASC,
        kti.id ASC
    `,
    [businessId, orderId],
  );

  return rows;
};

const findTicketPrints = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
): Promise<readonly KitchenTicketPrintRow[]> => {
  const [rows] = await connection.execute<KitchenTicketPrintRow[]>(
    `
      SELECT
        CAST(ktp.id AS CHAR) AS id,
        CAST(ktp.business_id AS CHAR) AS businessId,
        CAST(ktp.kitchen_ticket_id AS CHAR) AS kitchenTicketId,
        CAST(ktp.printed_by_membership_id AS CHAR)
          AS printedByMembershipId,
        ktp.ticket_version AS ticketVersion,
        ktp.print_type AS printType,
        ktp.reason,
        ktp.printer_name AS printerName,
        ktp.content_snapshot AS contentSnapshot,
        ktp.created_at AS createdAt
      FROM kitchen_ticket_prints AS ktp
      INNER JOIN kitchen_tickets AS kt
        ON kt.business_id = ktp.business_id
        AND kt.id = ktp.kitchen_ticket_id
      WHERE
        ktp.business_id = ?
        AND kt.order_id = ?
      ORDER BY
        ktp.created_at ASC,
        ktp.id ASC
    `,
    [businessId, orderId],
  );

  return rows;
};

const findOrderKitchenHistory = async (
  businessId: string,
  orderId: string,
): Promise<OrderKitchenHistory | null> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await findOrder(connection, businessId, orderId);

    if (!order) {
      await connection.rollback();
      return null;
    }

    const ticketRows = await findTickets(connection, businessId, orderId);

    const itemRows = await findTicketItems(connection, businessId, orderId);

    const printRows = await findTicketPrints(connection, businessId, orderId);

    await connection.commit();

    const itemsByTicket = new Map<string, KitchenTicketItem[]>();

    for (const row of itemRows) {
      const currentItems = itemsByTicket.get(row.kitchenTicketId) ?? [];

      currentItems.push({
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

      itemsByTicket.set(row.kitchenTicketId, currentItems);
    }

    const printsByTicket = new Map<string, KitchenTicketPrint[]>();

    for (const row of printRows) {
      const currentPrints = printsByTicket.get(row.kitchenTicketId) ?? [];

      currentPrints.push(mapPrint(row));

      printsByTicket.set(row.kitchenTicketId, currentPrints);
    }

    const tickets: OrderKitchenHistoryTicket[] = ticketRows.map((ticketRow) => {
      const items = itemsByTicket.get(ticketRow.id) ?? [];
      const prints = printsByTicket.get(ticketRow.id) ?? [];

      return {
        id: ticketRow.id,
        preparationAreaId: ticketRow.preparationAreaId,
        preparationAreaName: ticketRow.preparationAreaName,
        currentVersion: ticketRow.currentVersion,
        status: calculateOrderKitchenTicketStatus(
          items.map((item) => item.preparationStatus),
        ),
        items,
        prints,
        createdAt: ticketRow.createdAt,
        updatedAt: ticketRow.updatedAt,
      };
    });

    return {
      orderId: order.id,
      kitchenWorkflowMode: order.kitchenWorkflowMode,
      tickets,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { findOrderKitchenHistory };
