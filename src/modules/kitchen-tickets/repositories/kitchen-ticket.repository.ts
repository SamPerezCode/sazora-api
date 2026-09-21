import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderServiceType } from "../../orders/order.types";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type {
  KitchenPreparationStatus,
  KitchenTicket,
  KitchenTicketItem,
  KitchenTicketStatus,
} from "../kitchen-ticket.types";

type KitchenTicketRow = RowDataPacket & {
  ticketId: string;
  businessId: string;
  orderId: string;
  preparationAreaId: string;
  preparationAreaName: string;
  serviceType: OrderServiceType;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  orderNotes: string | null;
  currentVersion: number;
  ticketCreatedAt: Date;
  ticketUpdatedAt: Date;
  ticketItemId: string;
  orderItemId: string;
  productName: string;
  fulfillmentMode: ProductFulfillmentMode;
  quantity: number;
  itemNotes: string | null;
  preparationStatus: KitchenPreparationStatus;
  startedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  itemCreatedAt: Date;
  itemUpdatedAt: Date;
};

interface KitchenTicketAccumulator {
  ticket: Omit<KitchenTicket, "items" | "status">;
  items: KitchenTicketItem[];
}

const calculateKitchenTicketStatus = (
  items: readonly KitchenTicketItem[],
): KitchenTicketStatus => {
  const activeItems = items.filter(
    (item) =>
      item.preparationStatus !== "DELIVERED" &&
      item.preparationStatus !== "CANCELLED",
  );

  if (activeItems.some((item) => item.preparationStatus === "IN_PREPARATION")) {
    return "IN_PREPARATION";
  }

  if (
    activeItems.length > 0 &&
    activeItems.every((item) => item.preparationStatus === "READY")
  ) {
    return "READY";
  }

  return "PENDING";
};

const mapKitchenTicketItem = (row: KitchenTicketRow): KitchenTicketItem => ({
  id: row.ticketItemId,
  orderItemId: row.orderItemId,
  productName: row.productName,
  fulfillmentMode: row.fulfillmentMode,
  quantity: row.quantity,
  notes: row.itemNotes,
  preparationStatus: row.preparationStatus,
  startedAt: row.startedAt,
  readyAt: row.readyAt,
  deliveredAt: row.deliveredAt,
  cancelledAt: row.cancelledAt,
  createdAt: row.itemCreatedAt,
  updatedAt: row.itemUpdatedAt,
});

const findActiveKitchenTickets = async (
  businessId: string,
  preparationAreaId?: string,
): Promise<KitchenTicket[]> => {
  const whereConditions = ["kt.business_id = ?"];
  const queryValues: string[] = [businessId];

  if (preparationAreaId !== undefined) {
    whereConditions.push("kt.preparation_area_id = ?");
    queryValues.push(preparationAreaId);
  }

  const whereClause = whereConditions.join("\n          AND ");

  const [rows] = await databasePool.execute<KitchenTicketRow[]>(
    `
      SELECT
        CAST(kt.id AS CHAR) AS ticketId,
        CAST(kt.business_id AS CHAR) AS businessId,
        CAST(kt.order_id AS CHAR) AS orderId,
        CAST(kt.preparation_area_id AS CHAR)
          AS preparationAreaId,
        pa.name AS preparationAreaName,
        o.service_type AS serviceType,
        rt.code AS restaurantTableCode,
        rt.name AS restaurantTableName,
        o.notes AS orderNotes,
        kt.current_version AS currentVersion,
        kt.created_at AS ticketCreatedAt,
        kt.updated_at AS ticketUpdatedAt,
        CAST(kti.id AS CHAR) AS ticketItemId,
        CAST(kti.order_item_id AS CHAR) AS orderItemId,
        oi.product_name AS productName,
        oi.fulfillment_mode AS fulfillmentMode,
        oi.quantity,
        oi.notes AS itemNotes,
        kti.preparation_status AS preparationStatus,
        kti.started_at AS startedAt,
        kti.ready_at AS readyAt,
        kti.delivered_at AS deliveredAt,
        kti.cancelled_at AS cancelledAt,
        kti.created_at AS itemCreatedAt,
        kti.updated_at AS itemUpdatedAt
      FROM kitchen_tickets AS kt
      INNER JOIN orders AS o
        ON o.business_id = kt.business_id
        AND o.id = kt.order_id
      INNER JOIN preparation_areas AS pa
        ON pa.business_id = kt.business_id
        AND pa.id = kt.preparation_area_id
      LEFT JOIN restaurant_tables AS rt
        ON rt.business_id = o.business_id
        AND rt.id = o.restaurant_table_id
      INNER JOIN kitchen_ticket_items AS kti
        ON kti.business_id = kt.business_id
        AND kti.kitchen_ticket_id = kt.id
      INNER JOIN order_items AS oi
        ON oi.business_id = kti.business_id
        AND oi.id = kti.order_item_id
      WHERE
        ${whereClause}
        AND EXISTS (
          SELECT 1
          FROM kitchen_ticket_items AS active_item
          WHERE
            active_item.business_id = kt.business_id
            AND active_item.kitchen_ticket_id = kt.id
            AND active_item.preparation_status IN (
              'PENDING',
              'IN_PREPARATION',
              'READY'
            )
        )
      ORDER BY
        kt.created_at ASC,
        kt.id ASC,
        kti.created_at ASC,
        kti.id ASC
    `,
    queryValues,
  );

  const ticketsById = new Map<string, KitchenTicketAccumulator>();

  for (const row of rows) {
    let accumulator = ticketsById.get(row.ticketId);

    if (!accumulator) {
      accumulator = {
        ticket: {
          id: row.ticketId,
          businessId: row.businessId,
          orderId: row.orderId,
          preparationAreaId: row.preparationAreaId,
          preparationAreaName: row.preparationAreaName,
          serviceType: row.serviceType,
          restaurantTableCode: row.restaurantTableCode,
          restaurantTableName: row.restaurantTableName,
          orderNotes: row.orderNotes,
          currentVersion: row.currentVersion,
          createdAt: row.ticketCreatedAt,
          updatedAt: row.ticketUpdatedAt,
        },
        items: [],
      };

      ticketsById.set(row.ticketId, accumulator);
    }

    accumulator.items.push(mapKitchenTicketItem(row));
  }

  return [...ticketsById.values()].map(({ ticket, items }) => ({
    ...ticket,
    status: calculateKitchenTicketStatus(items),
    items,
  }));
};

export { findActiveKitchenTickets };
