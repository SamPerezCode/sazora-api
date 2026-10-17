import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type { KitchenWorkflowMode } from "../../kitchen-settings/kitchen-settings.types";

import type {
  KitchenOperationalMetrics,
  KitchenOperationReportFilters,
} from "../kitchen-operation-report.types";

type KitchenMetricRow = RowDataPacket & {
  workflowMode: KitchenWorkflowMode | null;

  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;

  preparationAreaId: string | null;
  preparationAreaName: string | null;

  orderCount: string;
  ticketCount: string;
  itemCount: string;

  pendingItemCount: string;
  inPreparationItemCount: string;
  readyItemCount: string;
  deliveredItemCount: string;
  cancelledItemCount: string;

  prepareToOrderItemCount: string;
  readyToServeItemCount: string;

  screenItemCount: string;

  queueSampleSize: string;
  averageQueueMinutes: string | null;

  preparationSampleSize: string;
  averagePreparationMinutes: string | null;

  handoffSampleSize: string;
  averageHandoffMinutes: string | null;

  totalCycleSampleSize: string;
  averageTotalCycleMinutes: string | null;

  printOnlyItemCount: string;

  printOnlyDeliverySampleSize: string;
  averagePrintOnlyDeliveryMinutes: string | null;
};

type KitchenMetricGroup = Readonly<{
  workflowMode: KitchenWorkflowMode | null;

  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;

  preparationAreaId: string | null;
  preparationAreaName: string | null;

  metrics: KitchenOperationalMetrics;
}>;

type Grouping = "OVERALL" | "WORKFLOW" | "LOCATION" | "AREA";

type SqlWhere = Readonly<{
  sql: string;
  values: readonly string[];
}>;

const createWhere = (
  businessId: string,
  filters: KitchenOperationReportFilters,
): SqlWhere => {
  const conditions: string[] = [
    "kti.business_id = ?",
    "kti.created_at >= ?",
    "kti.created_at < ?",
  ];

  const values: string[] = [
    businessId,
    filters.period.start,
    filters.period.end,
  ];

  if (filters.locationId !== undefined) {
    conditions.push("o.location_id = ?");
    values.push(filters.locationId);
  }

  if (filters.preparationAreaId !== undefined) {
    conditions.push("kti.preparation_area_id = ?");
    values.push(filters.preparationAreaId);
  }

  if (filters.workflowMode !== undefined) {
    conditions.push("o.kitchen_workflow_mode = ?");
    values.push(filters.workflowMode);
  }

  if (filters.serviceType !== undefined) {
    conditions.push("o.service_type = ?");
    values.push(filters.serviceType);
  }

  return {
    sql: conditions.join("\nAND "),
    values,
  };
};

const groupingConfiguration: Record<
  Grouping,
  Readonly<{
    select: string;
    groupBy: string;
    orderBy: string;
  }>
> = {
  OVERALL: {
    select: `
      NULL AS workflowMode,
      NULL AS locationId,
      NULL AS locationCode,
      NULL AS locationName,
      NULL AS preparationAreaId,
      NULL AS preparationAreaName
    `,
    groupBy: "",
    orderBy: "",
  },

  WORKFLOW: {
    select: `
      o.kitchen_workflow_mode AS workflowMode,
      NULL AS locationId,
      NULL AS locationCode,
      NULL AS locationName,
      NULL AS preparationAreaId,
      NULL AS preparationAreaName
    `,
    groupBy: `
      GROUP BY o.kitchen_workflow_mode
    `,
    orderBy: `
      ORDER BY o.kitchen_workflow_mode ASC
    `,
  },

  LOCATION: {
    select: `
      o.kitchen_workflow_mode AS workflowMode,

      CAST(bl.id AS CHAR) AS locationId,
      bl.code AS locationCode,
      bl.name AS locationName,

      NULL AS preparationAreaId,
      NULL AS preparationAreaName
    `,
    groupBy: `
      GROUP BY
        bl.id,
        bl.code,
        bl.name,
        o.kitchen_workflow_mode
    `,
    orderBy: `
      ORDER BY
        bl.name ASC,
        o.kitchen_workflow_mode ASC
    `,
  },

  AREA: {
    select: `
      o.kitchen_workflow_mode AS workflowMode,

      NULL AS locationId,
      NULL AS locationCode,
      NULL AS locationName,

      CAST(pa.id AS CHAR) AS preparationAreaId,
      pa.name AS preparationAreaName
    `,
    groupBy: `
      GROUP BY
        pa.id,
        pa.name,
        o.kitchen_workflow_mode
    `,
    orderBy: `
      ORDER BY
        pa.name ASC,
        o.kitchen_workflow_mode ASC
    `,
  },
};

const toNullableNumber = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }

  return Number(value);
};

const mapMetrics = (row: KitchenMetricRow): KitchenOperationalMetrics => ({
  orderCount: Number(row.orderCount),
  ticketCount: Number(row.ticketCount),
  itemCount: Number(row.itemCount),

  pendingItemCount: Number(row.pendingItemCount),

  inPreparationItemCount: Number(row.inPreparationItemCount),

  readyItemCount: Number(row.readyItemCount),
  deliveredItemCount: Number(row.deliveredItemCount),
  cancelledItemCount: Number(row.cancelledItemCount),

  prepareToOrderItemCount: Number(row.prepareToOrderItemCount),

  readyToServeItemCount: Number(row.readyToServeItemCount),

  screenTracking: {
    itemCount: Number(row.screenItemCount),

    queueTime: {
      sampleSize: Number(row.queueSampleSize),
      averageMinutes: toNullableNumber(row.averageQueueMinutes),
    },

    preparationTime: {
      sampleSize: Number(row.preparationSampleSize),
      averageMinutes: toNullableNumber(row.averagePreparationMinutes),
    },

    handoffTime: {
      sampleSize: Number(row.handoffSampleSize),
      averageMinutes: toNullableNumber(row.averageHandoffMinutes),
    },

    totalCycleTime: {
      sampleSize: Number(row.totalCycleSampleSize),
      averageMinutes: toNullableNumber(row.averageTotalCycleMinutes),
    },
  },

  printOnlyTracking: {
    itemCount: Number(row.printOnlyItemCount),

    confirmationToDeliveryTime: {
      sampleSize: Number(row.printOnlyDeliverySampleSize),

      averageMinutes: toNullableNumber(row.averagePrintOnlyDeliveryMinutes),
    },
  },
});

const findMetrics = async (
  businessId: string,
  filters: KitchenOperationReportFilters,
  grouping: Grouping,
): Promise<KitchenMetricGroup[]> => {
  const where = createWhere(businessId, filters);
  const configuration = groupingConfiguration[grouping];

  const [rows] = await databasePool.execute<KitchenMetricRow[]>(
    `
      SELECT
        ${configuration.select},

        CAST(
          COUNT(DISTINCT o.id)
          AS CHAR
        ) AS orderCount,

        CAST(
          COUNT(DISTINCT kt.id)
          AS CHAR
        ) AS ticketCount,

        CAST(
          COUNT(kti.id)
          AS CHAR
        ) AS itemCount,

        CAST(
          COALESCE(
            SUM(kti.preparation_status = 'PENDING'),
            0
          )
          AS CHAR
        ) AS pendingItemCount,

        CAST(
          COALESCE(
            SUM(
              kti.preparation_status = 'IN_PREPARATION'
            ),
            0
          )
          AS CHAR
        ) AS inPreparationItemCount,

        CAST(
          COALESCE(
            SUM(kti.preparation_status = 'READY'),
            0
          )
          AS CHAR
        ) AS readyItemCount,

        CAST(
          COALESCE(
            SUM(kti.preparation_status = 'DELIVERED'),
            0
          )
          AS CHAR
        ) AS deliveredItemCount,

        CAST(
          COALESCE(
            SUM(kti.preparation_status = 'CANCELLED'),
            0
          )
          AS CHAR
        ) AS cancelledItemCount,

        CAST(
          COALESCE(
            SUM(
              oi.fulfillment_mode = 'PREPARE_TO_ORDER'
            ),
            0
          )
          AS CHAR
        ) AS prepareToOrderItemCount,

        CAST(
          COALESCE(
            SUM(
              oi.fulfillment_mode = 'READY_TO_SERVE'
            ),
            0
          )
          AS CHAR
        ) AS readyToServeItemCount,

        CAST(
          COALESCE(
            SUM(
              o.kitchen_workflow_mode =
                'PRINT_AND_SCREEN'
            ),
            0
          )
          AS CHAR
        ) AS screenItemCount,

        CAST(
          COUNT(
            CASE
              WHEN
                o.kitchen_workflow_mode =
                  'PRINT_AND_SCREEN'
                AND oi.fulfillment_mode =
                  'PREPARE_TO_ORDER'
                AND kti.started_at IS NOT NULL
              THEN 1
            END
          )
          AS CHAR
        ) AS queueSampleSize,

        CAST(
          ROUND(
            AVG(
              CASE
                WHEN
                  o.kitchen_workflow_mode =
                    'PRINT_AND_SCREEN'
                  AND oi.fulfillment_mode =
                    'PREPARE_TO_ORDER'
                  AND kti.started_at IS NOT NULL
                THEN
                  TIMESTAMPDIFF(
                    MICROSECOND,
                    kti.created_at,
                    kti.started_at
                  ) / 60000000
              END
            ),
            2
          )
          AS CHAR
        ) AS averageQueueMinutes,

        CAST(
          COUNT(
            CASE
              WHEN
                o.kitchen_workflow_mode =
                  'PRINT_AND_SCREEN'
                AND oi.fulfillment_mode =
                  'PREPARE_TO_ORDER'
                AND kti.started_at IS NOT NULL
                AND kti.ready_at IS NOT NULL
              THEN 1
            END
          )
          AS CHAR
        ) AS preparationSampleSize,

        CAST(
          ROUND(
            AVG(
              CASE
                WHEN
                  o.kitchen_workflow_mode =
                    'PRINT_AND_SCREEN'
                  AND oi.fulfillment_mode =
                    'PREPARE_TO_ORDER'
                  AND kti.started_at IS NOT NULL
                  AND kti.ready_at IS NOT NULL
                THEN
                  TIMESTAMPDIFF(
                    MICROSECOND,
                    kti.started_at,
                    kti.ready_at
                  ) / 60000000
              END
            ),
            2
          )
          AS CHAR
        ) AS averagePreparationMinutes,

        CAST(
          COUNT(
            CASE
              WHEN
                o.kitchen_workflow_mode =
                  'PRINT_AND_SCREEN'
                AND kti.ready_at IS NOT NULL
                AND kti.delivered_at IS NOT NULL
              THEN 1
            END
          )
          AS CHAR
        ) AS handoffSampleSize,

        CAST(
          ROUND(
            AVG(
              CASE
                WHEN
                  o.kitchen_workflow_mode =
                    'PRINT_AND_SCREEN'
                  AND kti.ready_at IS NOT NULL
                  AND kti.delivered_at IS NOT NULL
                THEN
                  TIMESTAMPDIFF(
                    MICROSECOND,
                    kti.ready_at,
                    kti.delivered_at
                  ) / 60000000
              END
            ),
            2
          )
          AS CHAR
        ) AS averageHandoffMinutes,

        CAST(
          COUNT(
            CASE
              WHEN
                o.kitchen_workflow_mode =
                  'PRINT_AND_SCREEN'
                AND kti.delivered_at IS NOT NULL
              THEN 1
            END
          )
          AS CHAR
        ) AS totalCycleSampleSize,

        CAST(
          ROUND(
            AVG(
              CASE
                WHEN
                  o.kitchen_workflow_mode =
                    'PRINT_AND_SCREEN'
                  AND kti.delivered_at IS NOT NULL
                THEN
                  TIMESTAMPDIFF(
                    MICROSECOND,
                    kti.created_at,
                    kti.delivered_at
                  ) / 60000000
              END
            ),
            2
          )
          AS CHAR
        ) AS averageTotalCycleMinutes,

        CAST(
          COALESCE(
            SUM(
              o.kitchen_workflow_mode = 'PRINT_ONLY'
            ),
            0
          )
          AS CHAR
        ) AS printOnlyItemCount,

        CAST(
          COUNT(
            CASE
              WHEN
                o.kitchen_workflow_mode = 'PRINT_ONLY'
                AND kti.delivered_at IS NOT NULL
              THEN 1
            END
          )
          AS CHAR
        ) AS printOnlyDeliverySampleSize,

        CAST(
          ROUND(
            AVG(
              CASE
                WHEN
                  o.kitchen_workflow_mode = 'PRINT_ONLY'
                  AND kti.delivered_at IS NOT NULL
                THEN
                  TIMESTAMPDIFF(
                    MICROSECOND,
                    kti.created_at,
                    kti.delivered_at
                  ) / 60000000
              END
            ),
            2
          )
          AS CHAR
        ) AS averagePrintOnlyDeliveryMinutes

      FROM kitchen_ticket_items AS kti

      INNER JOIN kitchen_tickets AS kt
        ON kt.business_id = kti.business_id
        AND kt.id = kti.kitchen_ticket_id

      INNER JOIN orders AS o
        ON o.business_id = kti.business_id
        AND o.id = kti.order_id

      INNER JOIN order_items AS oi
        ON oi.business_id = kti.business_id
        AND oi.id = kti.order_item_id

      INNER JOIN business_locations AS bl
        ON bl.business_id = o.business_id
        AND bl.id = o.location_id

      INNER JOIN preparation_areas AS pa
        ON pa.business_id = kti.business_id
        AND pa.id = kti.preparation_area_id

      WHERE ${where.sql}

      ${configuration.groupBy}
      ${configuration.orderBy}
    `,
    [...where.values],
  );

  return rows.map((row) => ({
    workflowMode: row.workflowMode,

    locationId: row.locationId,
    locationCode: row.locationCode,
    locationName: row.locationName,

    preparationAreaId: row.preparationAreaId,
    preparationAreaName: row.preparationAreaName,

    metrics: mapMetrics(row),
  }));
};

const findOverallKitchenMetrics = async (
  businessId: string,
  filters: KitchenOperationReportFilters,
): Promise<KitchenOperationalMetrics> => {
  const rows = await findMetrics(businessId, filters, "OVERALL");

  const first = rows[0];

  if (!first) {
    throw new Error("No fue posible calcular el resumen operativo de cocina");
  }

  return first.metrics;
};

const findKitchenMetricsByWorkflow = (
  businessId: string,
  filters: KitchenOperationReportFilters,
): Promise<KitchenMetricGroup[]> =>
  findMetrics(businessId, filters, "WORKFLOW");

const findKitchenMetricsByLocation = (
  businessId: string,
  filters: KitchenOperationReportFilters,
): Promise<KitchenMetricGroup[]> =>
  findMetrics(businessId, filters, "LOCATION");

const findKitchenMetricsByArea = (
  businessId: string,
  filters: KitchenOperationReportFilters,
): Promise<KitchenMetricGroup[]> => findMetrics(businessId, filters, "AREA");

export {
  findKitchenMetricsByArea,
  findKitchenMetricsByLocation,
  findKitchenMetricsByWorkflow,
  findOverallKitchenMetrics,
};

export type { KitchenMetricGroup };
