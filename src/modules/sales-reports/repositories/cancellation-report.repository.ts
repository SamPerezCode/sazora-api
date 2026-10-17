import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type {
  CancellationByLocationRecord,
  CancellationHistoryItem,
  CancellationHistoryResult,
  CancellationReportFilters,
  CancellationSummary,
} from "../cancellation-report.types";

type CancellationSummaryRow = RowDataPacket & {
  cancellationEventCount: string;
  affectedOrderCount: string;
  fullyCancelledProductCount: string;
  partialCancellationCount: string;
  cancelledUnitCount: string;
  affectedAmount: string;
};

type CancelledOrderCountRow = RowDataPacket & {
  cancelledOrderCount: string;
};

type CancellationHistoryRow = RowDataPacket & {
  eventId: string;
  eventType: "FULL_ITEM" | "PARTIAL_QUANTITY";

  orderId: string;
  orderItemId: string;

  orderStatus: "OPEN" | "CONFIRMED" | "DELIVERED" | "CLOSED" | "CANCELLED";

  locationId: string;
  locationCode: string;
  locationName: string;

  serviceType: "TABLE" | "TAKEAWAY" | "DELIVERY";

  restaurantTableId: string | null;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;

  productId: string;
  productName: string;

  previousQuantity: number;
  remainingQuantity: number | null;
  cancelledQuantity: number;

  unitPrice: string;
  affectedAmount: string;

  reason: string;

  cancelledByMembershipId: string;
  cancelledByName: string;

  cancelledAt: Date;
};

type CountRow = RowDataPacket & {
  total: string;
};

type CancellationByLocationRow = RowDataPacket & {
  locationId: string;
  locationCode: string;
  locationName: string;

  cancellationEventCount: string;
  affectedOrderCount: string;
  cancelledUnitCount: string;
  affectedAmount: string;
};

type CancelledOrdersByLocationRow = RowDataPacket & {
  locationId: string;
  locationCode: string;
  locationName: string;
  cancelledOrderCount: string;
};

type SqlValue = string | number;

type SqlWhere = Readonly<{
  sql: string;
  values: readonly SqlValue[];
}>;

/*
 * Las cancelaciones completas se registran como CANCELLED.
 *
 * Las cancelaciones parciales se registran como QUANTITY_DECREASED
 * con una razón. Los cambios ordinarios de cantidad no tienen razón.
 */
const createCancellationEventWhere = (
  businessId: string,
  filters: CancellationReportFilters,
): SqlWhere => {
  const conditions: string[] = [
    "oic.business_id = ?",
    "oic.created_at >= ?",
    "oic.created_at < ?",
    `(
      oic.change_type = 'CANCELLED'
      OR (
        oic.change_type = 'QUANTITY_DECREASED'
        AND oic.reason IS NOT NULL
      )
    )`,
  ];

  const values: SqlValue[] = [
    businessId,
    filters.period.start,
    filters.period.end,
  ];

  if (filters.locationId !== undefined) {
    conditions.push("o.location_id = ?");
    values.push(filters.locationId);
  }

  if (filters.serviceType !== undefined) {
    conditions.push("o.service_type = ?");
    values.push(filters.serviceType);
  }

  if (filters.cancelledByMembershipId !== undefined) {
    conditions.push("oic.changed_by_membership_id = ?");
    values.push(filters.cancelledByMembershipId);
  }

  if (filters.eventType === "FULL_ITEM") {
    conditions.push("oic.change_type = 'CANCELLED'");
  }

  if (filters.eventType === "PARTIAL_QUANTITY") {
    conditions.push(`
      oic.change_type = 'QUANTITY_DECREASED'
      AND oic.reason IS NOT NULL
    `);
  }

  return {
    sql: conditions.join("\nAND "),
    values,
  };
};

const createCancelledOrderWhere = (
  businessId: string,
  filters: CancellationReportFilters,
): SqlWhere => {
  const conditions: string[] = [
    "osh.business_id = ?",
    "osh.new_status = 'CANCELLED'",
    "osh.created_at >= ?",
    "osh.created_at < ?",
  ];

  const values: SqlValue[] = [
    businessId,
    filters.period.start,
    filters.period.end,
  ];

  if (filters.locationId !== undefined) {
    conditions.push("o.location_id = ?");
    values.push(filters.locationId);
  }

  if (filters.serviceType !== undefined) {
    conditions.push("o.service_type = ?");
    values.push(filters.serviceType);
  }

  if (filters.cancelledByMembershipId !== undefined) {
    conditions.push("osh.changed_by_membership_id = ?");
    values.push(filters.cancelledByMembershipId);
  }

  return {
    sql: conditions.join("\nAND "),
    values,
  };
};

const findCancellationSummary = async (
  businessId: string,
  filters: CancellationReportFilters,
): Promise<CancellationSummary> => {
  const eventWhere = createCancellationEventWhere(businessId, filters);

  const cancelledOrderWhere = createCancelledOrderWhere(businessId, filters);

  const [eventRows] = await databasePool.execute<CancellationSummaryRow[]>(
    `
        SELECT
          CAST(COUNT(*) AS CHAR)
            AS cancellationEventCount,

          CAST(
            COUNT(DISTINCT o.id)
            AS CHAR
          ) AS affectedOrderCount,

          CAST(
            COALESCE(
              SUM(
                CASE
                  WHEN oic.change_type = 'CANCELLED'
                    THEN 1
                  ELSE 0
                END
              ),
              0
            )
            AS CHAR
          ) AS fullyCancelledProductCount,

          CAST(
            COALESCE(
              SUM(
                CASE
                  WHEN oic.change_type = 'QUANTITY_DECREASED'
                    THEN 1
                  ELSE 0
                END
              ),
              0
            )
            AS CHAR
          ) AS partialCancellationCount,

          CAST(
            COALESCE(
              SUM(
                CASE
                  WHEN oic.change_type = 'CANCELLED'
                    THEN oic.previous_quantity
                  ELSE
                    oic.previous_quantity - oic.new_quantity
                END
              ),
              0
            )
            AS CHAR
          ) AS cancelledUnitCount,

          CAST(
            COALESCE(
              SUM(
                (
                  CASE
                    WHEN oic.change_type = 'CANCELLED'
                      THEN oic.previous_quantity
                    ELSE
                      oic.previous_quantity - oic.new_quantity
                  END
                ) * oi.unit_price
              ),
              0
            )
            AS CHAR
          ) AS affectedAmount

        FROM order_item_changes AS oic

        INNER JOIN order_items AS oi
          ON oi.business_id = oic.business_id
          AND oi.id = oic.order_item_id

        INNER JOIN orders AS o
          ON o.business_id = oi.business_id
          AND o.id = oi.order_id

        WHERE ${eventWhere.sql}
      `,
    [...eventWhere.values],
  );

  const [orderRows] = await databasePool.execute<CancelledOrderCountRow[]>(
    `
        SELECT
          CAST(
            COUNT(DISTINCT osh.order_id)
            AS CHAR
          ) AS cancelledOrderCount

        FROM order_status_history AS osh

        INNER JOIN orders AS o
          ON o.business_id = osh.business_id
          AND o.id = osh.order_id

        WHERE ${cancelledOrderWhere.sql}
      `,
    [...cancelledOrderWhere.values],
  );

  const eventSummary = eventRows[0];
  const orderSummary = orderRows[0];

  return {
    cancelledOrderCount: Number(orderSummary?.cancelledOrderCount ?? 0),

    cancellationEventCount: Number(eventSummary?.cancellationEventCount ?? 0),

    affectedOrderCount: Number(eventSummary?.affectedOrderCount ?? 0),

    fullyCancelledProductCount: Number(
      eventSummary?.fullyCancelledProductCount ?? 0,
    ),

    partialCancellationCount: Number(
      eventSummary?.partialCancellationCount ?? 0,
    ),

    cancelledUnitCount: Number(eventSummary?.cancelledUnitCount ?? 0),

    affectedAmount: eventSummary?.affectedAmount ?? "0.00",
  };
};

const findCancellationHistory = async (
  businessId: string,
  filters: CancellationReportFilters,
): Promise<CancellationHistoryResult> => {
  const where = createCancellationEventWhere(businessId, filters);

  const offset = (filters.page - 1) * filters.pageSize;

  const [countRows] = await databasePool.execute<CountRow[]>(
    `
      SELECT
        CAST(COUNT(*) AS CHAR) AS total

      FROM order_item_changes AS oic

      INNER JOIN order_items AS oi
        ON oi.business_id = oic.business_id
        AND oi.id = oic.order_item_id

      INNER JOIN orders AS o
        ON o.business_id = oi.business_id
        AND o.id = oi.order_id

      WHERE ${where.sql}
    `,
    [...where.values],
  );

  const [rows] = await databasePool.execute<CancellationHistoryRow[]>(
    `
        SELECT
          CAST(oic.id AS CHAR)
            AS eventId,

          CASE
            WHEN oic.change_type = 'CANCELLED'
              THEN 'FULL_ITEM'
            ELSE 'PARTIAL_QUANTITY'
          END AS eventType,

          CAST(o.id AS CHAR)
            AS orderId,

          CAST(oi.id AS CHAR)
            AS orderItemId,

          o.status AS orderStatus,

          CAST(bl.id AS CHAR)
            AS locationId,

          bl.code AS locationCode,
          bl.name AS locationName,

          o.service_type AS serviceType,

          CAST(rt.id AS CHAR)
            AS restaurantTableId,

          rt.code AS restaurantTableCode,
          rt.name AS restaurantTableName,

          CAST(oi.product_id AS CHAR)
            AS productId,

          oi.product_name AS productName,

          oic.previous_quantity AS previousQuantity,
          oic.new_quantity AS remainingQuantity,

          CASE
            WHEN oic.change_type = 'CANCELLED'
              THEN oic.previous_quantity
            ELSE
              oic.previous_quantity - oic.new_quantity
          END AS cancelledQuantity,

          CAST(oi.unit_price AS CHAR)
            AS unitPrice,

          CAST(
            (
              CASE
                WHEN oic.change_type = 'CANCELLED'
                  THEN oic.previous_quantity
                ELSE
                  oic.previous_quantity - oic.new_quantity
              END
            ) * oi.unit_price
            AS CHAR
          ) AS affectedAmount,

          oic.reason AS reason,

          CAST(
            oic.changed_by_membership_id
            AS CHAR
          ) AS cancelledByMembershipId,

          u.full_name AS cancelledByName,

          oic.created_at AS cancelledAt

        FROM order_item_changes AS oic

        INNER JOIN order_items AS oi
          ON oi.business_id = oic.business_id
          AND oi.id = oic.order_item_id

        INNER JOIN orders AS o
          ON o.business_id = oi.business_id
          AND o.id = oi.order_id

        INNER JOIN business_locations AS bl
          ON bl.business_id = o.business_id
          AND bl.id = o.location_id

        INNER JOIN business_memberships AS bm
          ON bm.business_id = oic.business_id
          AND bm.id = oic.changed_by_membership_id

        INNER JOIN users AS u
          ON u.id = bm.user_id

        LEFT JOIN restaurant_tables AS rt
          ON rt.business_id = o.business_id
          AND rt.id = o.restaurant_table_id

        WHERE ${where.sql}

        ORDER BY
          oic.created_at DESC,
          oic.id DESC

        LIMIT ?
        OFFSET ?
      `,
    [...where.values, filters.pageSize, offset],
  );

  const total = Number(countRows[0]?.total ?? 0);

  const cancellations: CancellationHistoryItem[] = rows.map((row) => ({
    eventId: row.eventId,
    eventType: row.eventType,

    orderId: row.orderId,
    orderItemId: row.orderItemId,

    orderStatus: row.orderStatus,
    orderIsCancelled: row.orderStatus === "CANCELLED",

    locationId: row.locationId,
    locationCode: row.locationCode,
    locationName: row.locationName,

    serviceType: row.serviceType,

    restaurantTableId: row.restaurantTableId,
    restaurantTableCode: row.restaurantTableCode,
    restaurantTableName: row.restaurantTableName,

    productId: row.productId,
    productName: row.productName,

    previousQuantity: row.previousQuantity,
    remainingQuantity: row.remainingQuantity,
    cancelledQuantity: row.cancelledQuantity,

    unitPrice: row.unitPrice,
    affectedAmount: row.affectedAmount,

    reason: row.reason,

    cancelledByMembershipId: row.cancelledByMembershipId,

    cancelledByName: row.cancelledByName,
    cancelledAt: row.cancelledAt,
  }));

  return {
    cancellations,

    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

const findCancellationEventsByLocation = async (
  businessId: string,
  filters: CancellationReportFilters,
): Promise<CancellationByLocationRow[]> => {
  const where = createCancellationEventWhere(businessId, filters);

  const [rows] = await databasePool.execute<CancellationByLocationRow[]>(
    `
        SELECT
          CAST(bl.id AS CHAR)
            AS locationId,

          bl.code AS locationCode,
          bl.name AS locationName,

          CAST(COUNT(*) AS CHAR)
            AS cancellationEventCount,

          CAST(
            COUNT(DISTINCT o.id)
            AS CHAR
          ) AS affectedOrderCount,

          CAST(
            COALESCE(
              SUM(
                CASE
                  WHEN oic.change_type = 'CANCELLED'
                    THEN oic.previous_quantity
                  ELSE
                    oic.previous_quantity - oic.new_quantity
                END
              ),
              0
            )
            AS CHAR
          ) AS cancelledUnitCount,

          CAST(
            COALESCE(
              SUM(
                (
                  CASE
                    WHEN oic.change_type = 'CANCELLED'
                      THEN oic.previous_quantity
                    ELSE
                      oic.previous_quantity - oic.new_quantity
                  END
                ) * oi.unit_price
              ),
              0
            )
            AS CHAR
          ) AS affectedAmount

        FROM order_item_changes AS oic

        INNER JOIN order_items AS oi
          ON oi.business_id = oic.business_id
          AND oi.id = oic.order_item_id

        INNER JOIN orders AS o
          ON o.business_id = oi.business_id
          AND o.id = oi.order_id

        INNER JOIN business_locations AS bl
          ON bl.business_id = o.business_id
          AND bl.id = o.location_id

        WHERE ${where.sql}

        GROUP BY
          bl.id,
          bl.code,
          bl.name

        ORDER BY
          SUM(
            (
              CASE
                WHEN oic.change_type = 'CANCELLED'
                  THEN oic.previous_quantity
                ELSE
                  oic.previous_quantity - oic.new_quantity
              END
            ) * oi.unit_price
          ) DESC,
          bl.name ASC
      `,
    [...where.values],
  );

  return rows;
};

const findCancelledOrdersByLocation = async (
  businessId: string,
  filters: CancellationReportFilters,
): Promise<CancelledOrdersByLocationRow[]> => {
  const where = createCancelledOrderWhere(businessId, filters);

  const [rows] = await databasePool.execute<CancelledOrdersByLocationRow[]>(
    `
        SELECT
          CAST(bl.id AS CHAR)
            AS locationId,

          bl.code AS locationCode,
          bl.name AS locationName,

          CAST(
            COUNT(DISTINCT osh.order_id)
            AS CHAR
          ) AS cancelledOrderCount

        FROM order_status_history AS osh

        INNER JOIN orders AS o
          ON o.business_id = osh.business_id
          AND o.id = osh.order_id

        INNER JOIN business_locations AS bl
          ON bl.business_id = o.business_id
          AND bl.id = o.location_id

        WHERE ${where.sql}

        GROUP BY
          bl.id,
          bl.code,
          bl.name

        ORDER BY
          COUNT(DISTINCT osh.order_id) DESC,
          bl.name ASC
      `,
    [...where.values],
  );

  return rows;
};

const findCancellationByLocation = async (
  businessId: string,
  filters: CancellationReportFilters,
): Promise<CancellationByLocationRecord[]> => {
  const [eventRows, orderRows] = await Promise.all([
    findCancellationEventsByLocation(businessId, filters),

    findCancelledOrdersByLocation(businessId, filters),
  ]);

  const records = new Map<string, CancellationByLocationRecord>();

  for (const row of eventRows) {
    records.set(row.locationId, {
      locationId: row.locationId,
      locationCode: row.locationCode,
      locationName: row.locationName,

      cancelledOrderCount: 0,
      cancellationEventCount: Number(row.cancellationEventCount),

      affectedOrderCount: Number(row.affectedOrderCount),
      cancelledUnitCount: Number(row.cancelledUnitCount),
      affectedAmount: row.affectedAmount,
    });
  }

  for (const row of orderRows) {
    const current = records.get(row.locationId);

    if (current) {
      records.set(row.locationId, {
        ...current,
        cancelledOrderCount: Number(row.cancelledOrderCount),
      });

      continue;
    }

    records.set(row.locationId, {
      locationId: row.locationId,
      locationCode: row.locationCode,
      locationName: row.locationName,

      cancelledOrderCount: Number(row.cancelledOrderCount),

      cancellationEventCount: 0,
      affectedOrderCount: 0,
      cancelledUnitCount: 0,
      affectedAmount: "0.00",
    });
  }

  return [...records.values()].sort(
    (first, second) =>
      Number(second.affectedAmount) - Number(first.affectedAmount) ||
      first.locationName.localeCompare(second.locationName),
  );
};

export {
  findCancellationByLocation,
  findCancellationHistory,
  findCancellationSummary,
};
