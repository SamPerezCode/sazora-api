import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenWorkflowMode } from "../../kitchen-settings/kitchen-settings.types";
import type {
  ListOrdersFilters,
  OrderListItem,
  OrderListResult,
  OrderServiceType,
  OrderStatus,
} from "../order.types";

type OrderListRow = RowDataPacket & {
  id: string;
  businessId: string;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: OrderServiceType;
  status: OrderStatus;
  kitchenWorkflowMode: KitchenWorkflowMode | null;
  customerCount: number | null;
  notes: string | null;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  activeItemCount: string;
  subtotal: string;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: "PRODUCTION_WAREHOUSE" | "POINT_OF_SALE";
  locationIsActive: number;
};

type OrderCountRow = RowDataPacket & {
  total: string;
};

const mapOrderListRow = (row: OrderListRow): OrderListItem => ({
  id: row.id,
  businessId: row.businessId,
  restaurantTableId: row.restaurantTableId,
  openedByMembershipId: row.openedByMembershipId,
  serviceType: row.serviceType,
  status: row.status,
  kitchenWorkflowMode: row.kitchenWorkflowMode,
  customerCount: row.customerCount,
  notes: row.notes,
  restaurantTableCode: row.restaurantTableCode,
  restaurantTableName: row.restaurantTableName,
  activeItemCount: Number(row.activeItemCount),
  subtotal: row.subtotal,
  confirmedAt: row.confirmedAt,
  deliveredAt: row.deliveredAt,
  closedAt: row.closedAt,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  locationId: row.locationId,
  location: {
    id: row.locationId,
    code: row.locationCode,
    name: row.locationName,
    locationType: row.locationType,
    isActive: Boolean(row.locationIsActive),
  },
});

const findOrdersByBusinessId = async (
  businessId: string,
  filters: ListOrdersFilters,
): Promise<OrderListResult> => {
  const connection = await databasePool.getConnection();

  const whereConditions = ["o.business_id = ?"];
  const queryValues: (string | number)[] = [businessId];
  if (filters.status) {
    whereConditions.push("o.status = ?");
    queryValues.push(filters.status);
  }

  if (filters.serviceType) {
    whereConditions.push("o.service_type = ?");
    queryValues.push(filters.serviceType);
  }
  if (filters.locationId) {
    whereConditions.push("o.location_id = ?");
    queryValues.push(filters.locationId);
  }

  const whereClause = whereConditions.join("\n          AND ");
  const offset = (filters.page - 1) * filters.pageSize;

  try {
    await connection.beginTransaction();

    const [countRows] = await connection.execute<OrderCountRow[]>(
      `
        SELECT CAST(COUNT(*) AS CHAR) AS total
        FROM orders AS o
        WHERE ${whereClause}
      `,
      queryValues,
    );

    const total = Number(countRows[0]?.total ?? 0);

    const [orderRows] = await connection.execute<OrderListRow[]>(
      `
        SELECT
          CAST(o.id AS CHAR) AS id,
          CAST(o.business_id AS CHAR) AS businessId,
          CAST(o.restaurant_table_id AS CHAR) AS restaurantTableId,
          CAST(o.location_id AS CHAR) AS locationId,
          bl.code AS locationCode,
          bl.name AS locationName,
          bl.location_type AS locationType,
          bl.is_active AS locationIsActive,
          CAST(o.opened_by_membership_id AS CHAR)
            AS openedByMembershipId,
          o.service_type AS serviceType,
          o.status,
          o.kitchen_workflow_mode AS kitchenWorkflowMode,
          o.customer_count AS customerCount,
          o.notes,
          rt.code AS restaurantTableCode,
          rt.name AS restaurantTableName,
          CAST(
            COALESCE(item_totals.active_item_count, 0)
            AS CHAR
          ) AS activeItemCount,
          CAST(
            COALESCE(item_totals.subtotal, 0.00)
            AS CHAR
          ) AS subtotal,
          o.confirmed_at AS confirmedAt,
          o.delivered_at AS deliveredAt,
          o.closed_at AS closedAt,
          o.cancelled_at AS cancelledAt,
          o.created_at AS createdAt,
          o.updated_at AS updatedAt
        FROM orders AS o
        INNER JOIN business_locations AS bl
        ON bl.business_id = o.business_id
          AND bl.id = o.location_id
        LEFT JOIN restaurant_tables AS rt
          ON rt.business_id = o.business_id
          AND rt.id = o.restaurant_table_id
        LEFT JOIN (
          SELECT
            business_id,
            order_id,
            COUNT(*) AS active_item_count,
            SUM(quantity * unit_price) AS subtotal
          FROM order_items
          WHERE status = 'ACTIVE'
          GROUP BY
            business_id,
            order_id
        ) AS item_totals
          ON item_totals.business_id = o.business_id
          AND item_totals.order_id = o.id
        WHERE ${whereClause}
        ORDER BY
          o.created_at DESC,
          o.id DESC
        LIMIT ?
        OFFSET ?
      `,
      [...queryValues, filters.pageSize, offset],
    );

    await connection.commit();

    return {
      orders: orderRows.map(mapOrderListRow),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { findOrdersByBusinessId };
