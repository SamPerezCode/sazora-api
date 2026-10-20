import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type {
  ProductionOrderHistoryResult,
  ProductionReportDateField,
  ProductionReportFilters,
  ProductionReportOrder,
  ProductionReportOutput,
} from "../production-report.types";

import type { ProductionOrderStatus } from "../../production-orders/production-order.types";

type SqlValue = string | number;

type ProductionReportOrderRow = RowDataPacket & {
  productionOrderId: string;

  status: ProductionOrderStatus;
  batchQuantity: string;

  recipeId: string;
  recipeCode: string;
  recipeName: string;

  locationId: string;
  locationCode: string;
  locationName: string;

  responsibleMembershipId: string;
  responsibleName: string;

  plannedFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;

  inputCount: string;
  outputCount: string;

  expectedInputCostAtActualRate: string | null;
  actualInputCost: string | null;
  inputCostDifference: string | null;
  inputCostVariationPercentage: string | null;

  declaredWasteCost: string;

  totalResourceCost: string | null;
  producedInventoryValue: string | null;
};

type ProductionReportOutputRow = RowDataPacket & {
  productionOrderId: string;

  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;

  plannedQuantity: string;
  actualQuantity: string | null;
  baseUnit: string;
};

type CountRow = RowDataPacket & {
  total: string;
};

type ProductionReportWhere = Readonly<{
  sql: string;
  values: readonly SqlValue[];
}>;

const dateColumnByField: Readonly<Record<ProductionReportDateField, string>> = {
  CREATED: "po.created_at",
  PLANNED: "po.planned_for",
  STARTED: "po.started_at",
  COMPLETED: "po.completed_at",
};

const buildProductionReportWhere = (
  businessId: string,
  filters: ProductionReportFilters,
): ProductionReportWhere => {
  const dateColumn = dateColumnByField[filters.dateField];

  const conditions = [
    "po.business_id = ?",
    `${dateColumn} >= ?`,
    `${dateColumn} < ?`,
  ];

  const values: SqlValue[] = [
    businessId,
    filters.period.start,
    filters.period.end,
  ];

  if (filters.locationIds !== null) {
    const placeholders = filters.locationIds.map(() => "?").join(", ");

    conditions.push(`po.location_id IN (${placeholders})`);

    values.push(...filters.locationIds);
  }

  if (filters.status !== undefined) {
    conditions.push("po.status = ?");
    values.push(filters.status);
  }

  if (filters.outputInventoryItemId !== undefined) {
    conditions.push(`
      EXISTS (
        SELECT 1

        FROM production_order_outputs
          AS filtered_output

        WHERE
          filtered_output.business_id =
            po.business_id

          AND filtered_output.production_order_id =
            po.id

          AND filtered_output.inventory_item_id = ?
      )
    `);

    values.push(filters.outputInventoryItemId);
  }

  if (filters.membershipId !== undefined) {
    conditions.push(`
      COALESCE(
        po.completed_by_membership_id,
        po.started_by_membership_id,
        po.created_by_membership_id
      ) = ?
    `);

    values.push(filters.membershipId);
  }

  if (filters.search !== undefined) {
    conditions.push(`
      (
        po.recipe_code_snapshot LIKE ?
        OR po.recipe_name_snapshot LIKE ?
        OR CAST(po.id AS CHAR) = ?
      )
    `);

    const searchPattern = `%${filters.search}%`;

    values.push(searchPattern, searchPattern, filters.search);
  }

  return {
    sql: conditions.join("\n AND "),
    values,
  };
};

const inputCostTotalsJoin = `
  LEFT JOIN (
    SELECT
      poi.business_id,
      poi.production_order_id,

      COUNT(*) AS input_count,

      CASE
        WHEN COUNT(*) = SUM(
          CASE
            WHEN movement_line.unit_cost IS NOT NULL
              THEN 1
            ELSE 0
          END
        )
        THEN SUM(
          poi.planned_quantity *
          movement_line.unit_cost
        )
        ELSE NULL
      END AS expected_input_cost,

      CASE
        WHEN COUNT(*) = SUM(
          CASE
            WHEN movement_line.total_cost IS NOT NULL
              THEN 1
            ELSE 0
          END
        )
        THEN SUM(movement_line.total_cost)
        ELSE NULL
      END AS actual_input_cost

    FROM production_order_inputs AS poi

    INNER JOIN production_orders AS input_order
      ON input_order.business_id = poi.business_id
      AND input_order.id =
        poi.production_order_id

    LEFT JOIN inventory_movement_lines
      AS movement_line

      ON movement_line.business_id =
        input_order.business_id

      AND movement_line.movement_id =
        input_order.inventory_movement_id

      AND movement_line.inventory_item_id =
        poi.inventory_item_id

      AND movement_line.direction = 'OUT'

    GROUP BY
      poi.business_id,
      poi.production_order_id
  ) AS input_costs

    ON input_costs.business_id = po.business_id
    AND input_costs.production_order_id = po.id
`;

const outputValueTotalsJoin = `
  LEFT JOIN (
    SELECT
      poo.business_id,
      poo.production_order_id,

      COUNT(*) AS output_count,

      CASE
        WHEN COUNT(*) = SUM(
          CASE
            WHEN movement_line.total_cost IS NOT NULL
              THEN 1
            ELSE 0
          END
        )
        THEN SUM(movement_line.total_cost)
        ELSE NULL
      END AS produced_inventory_value

    FROM production_order_outputs AS poo

    INNER JOIN production_orders AS output_order
      ON output_order.business_id =
        poo.business_id

      AND output_order.id =
        poo.production_order_id

    LEFT JOIN inventory_movement_lines
      AS movement_line

      ON movement_line.business_id =
        output_order.business_id

      AND movement_line.movement_id =
        output_order.inventory_movement_id

      AND movement_line.inventory_item_id =
        poo.inventory_item_id

      AND movement_line.direction = 'IN'

    GROUP BY
      poo.business_id,
      poo.production_order_id
  ) AS output_values

    ON output_values.business_id = po.business_id
    AND output_values.production_order_id = po.id
`;

const wasteCostTotalsJoin = `
  LEFT JOIN (
    SELECT
      waste.business_id,
      waste.production_order_id,

      COALESCE(
        SUM(movement_line.total_cost),
        0.000000
      ) AS declared_waste_cost

    FROM production_order_waste_records
      AS waste

    INNER JOIN inventory_movement_lines
      AS movement_line

      ON movement_line.business_id =
        waste.business_id

      AND movement_line.movement_id =
        waste.inventory_movement_id

    GROUP BY
      waste.business_id,
      waste.production_order_id
  ) AS waste_costs

    ON waste_costs.business_id = po.business_id
    AND waste_costs.production_order_id = po.id
`;

const findProductionReportOutputs = async (
  businessId: string,
  productionOrderIds: readonly string[],
): Promise<ReadonlyMap<string, readonly ProductionReportOutput[]>> => {
  if (productionOrderIds.length === 0) {
    return new Map();
  }

  const placeholders = productionOrderIds.map(() => "?").join(", ");

  const [rows] = await databasePool.execute<ProductionReportOutputRow[]>(
    `
        SELECT
          CAST(
            poo.production_order_id AS CHAR
          ) AS productionOrderId,

          CAST(
            poo.inventory_item_id AS CHAR
          ) AS inventoryItemId,

          poo.item_name_snapshot
            AS inventoryItemName,

          poo.item_sku_snapshot
            AS inventoryItemSku,

          CAST(
            poo.planned_quantity AS CHAR
          ) AS plannedQuantity,

          CAST(
            poo.actual_quantity AS CHAR
          ) AS actualQuantity,

          poo.base_unit_snapshot AS baseUnit

        FROM production_order_outputs AS poo

        WHERE
          poo.business_id = ?

          AND poo.production_order_id
            IN (${placeholders})

        ORDER BY
          poo.production_order_id DESC,
          poo.id ASC
      `,
    [businessId, ...productionOrderIds],
  );

  const outputMap = new Map<string, ProductionReportOutput[]>();

  for (const row of rows) {
    const currentOutputs = outputMap.get(row.productionOrderId) ?? [];

    currentOutputs.push({
      inventoryItemId: row.inventoryItemId,

      inventoryItemName: row.inventoryItemName,

      inventoryItemSku: row.inventoryItemSku,

      plannedQuantity: row.plannedQuantity,
      actualQuantity: row.actualQuantity,
      baseUnit: row.baseUnit,
    });

    outputMap.set(row.productionOrderId, currentOutputs);
  }

  return outputMap;
};

const findProductionOrderHistory = async (
  businessId: string,
  filters: ProductionReportFilters,
): Promise<ProductionOrderHistoryResult> => {
  if (filters.locationIds !== null && filters.locationIds.length === 0) {
    return {
      orders: [],
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const where = buildProductionReportWhere(businessId, filters);

  const dateColumn = dateColumnByField[filters.dateField];

  const offset = (filters.page - 1) * filters.pageSize;

  const [countRows] = await databasePool.execute<CountRow[]>(
    `
        SELECT
          CAST(COUNT(*) AS CHAR) AS total

        FROM production_orders AS po

        WHERE ${where.sql}
      `,
    [...where.values],
  );

  const total = Number(countRows[0]?.total ?? "0");

  const [rows] = await databasePool.execute<ProductionReportOrderRow[]>(
    `
        SELECT
          CAST(po.id AS CHAR)
            AS productionOrderId,

          po.status,

          CAST(po.batch_quantity AS CHAR)
            AS batchQuantity,

          CAST(po.recipe_id AS CHAR)
            AS recipeId,

          po.recipe_code_snapshot
            AS recipeCode,

          po.recipe_name_snapshot
            AS recipeName,

          CAST(po.location_id AS CHAR)
            AS locationId,

          location.code AS locationCode,
          location.name AS locationName,

          CAST(
            COALESCE(
              po.completed_by_membership_id,
              po.started_by_membership_id,
              po.created_by_membership_id
            ) AS CHAR
          ) AS responsibleMembershipId,

          COALESCE(
            completed_user.full_name,
            started_user.full_name,
            created_user.full_name
          ) AS responsibleName,

          po.planned_for AS plannedFor,
          po.started_at AS startedAt,
          po.completed_at AS completedAt,
          po.created_at AS createdAt,

          CAST(
            COALESCE(
              input_costs.input_count,
              0
            ) AS CHAR
          ) AS inputCount,

          CAST(
            COALESCE(
              output_values.output_count,
              0
            ) AS CHAR
          ) AS outputCount,

          CAST(
            input_costs.expected_input_cost
            AS CHAR
          ) AS expectedInputCostAtActualRate,

          CAST(
            input_costs.actual_input_cost
            AS CHAR
          ) AS actualInputCost,

          CAST(
            CASE
              WHEN
                input_costs.actual_input_cost
                  IS NOT NULL

                AND
                input_costs.expected_input_cost
                  IS NOT NULL

              THEN
                input_costs.actual_input_cost -
                input_costs.expected_input_cost

              ELSE NULL
            END
            AS CHAR
          ) AS inputCostDifference,

          CAST(
            CASE
              WHEN
                input_costs.actual_input_cost
                  IS NOT NULL

                AND
                input_costs.expected_input_cost
                  IS NOT NULL

                AND
                input_costs.expected_input_cost <> 0

              THEN
                (
                  (
                    input_costs.actual_input_cost -
                    input_costs.expected_input_cost
                  ) /
                  input_costs.expected_input_cost
                ) * 100

              ELSE NULL
            END
            AS CHAR
          ) AS inputCostVariationPercentage,

          CAST(
            COALESCE(
              waste_costs.declared_waste_cost,
              0.000000
            ) AS CHAR
          ) AS declaredWasteCost,

          CAST(
            CASE
              WHEN
                input_costs.actual_input_cost
                  IS NOT NULL

              THEN
                input_costs.actual_input_cost +
                COALESCE(
                  waste_costs.declared_waste_cost,
                  0.000000
                )

              ELSE NULL
            END
            AS CHAR
          ) AS totalResourceCost,

          CAST(
            output_values.produced_inventory_value
            AS CHAR
          ) AS producedInventoryValue

        FROM production_orders AS po

        INNER JOIN business_locations
          AS location

          ON location.business_id =
            po.business_id

          AND location.id =
            po.location_id

        INNER JOIN business_memberships
          AS created_membership

          ON created_membership.business_id =
            po.business_id

          AND created_membership.id =
            po.created_by_membership_id

        INNER JOIN users AS created_user
          ON created_user.id =
            created_membership.user_id

        LEFT JOIN business_memberships
          AS started_membership

          ON started_membership.business_id =
            po.business_id

          AND started_membership.id =
            po.started_by_membership_id

        LEFT JOIN users AS started_user
          ON started_user.id =
            started_membership.user_id

        LEFT JOIN business_memberships
          AS completed_membership

          ON completed_membership.business_id =
            po.business_id

          AND completed_membership.id =
            po.completed_by_membership_id

        LEFT JOIN users AS completed_user
          ON completed_user.id =
            completed_membership.user_id

        ${inputCostTotalsJoin}
        ${outputValueTotalsJoin}
        ${wasteCostTotalsJoin}

        WHERE ${where.sql}

        ORDER BY
          ${dateColumn} DESC,
          po.id DESC

        LIMIT ?
        OFFSET ?
      `,
    [...where.values, filters.pageSize, offset],
  );

  const productionOrderIds = rows.map((row) => row.productionOrderId);

  const outputMap = await findProductionReportOutputs(
    businessId,
    productionOrderIds,
  );

  const orders: ProductionReportOrder[] = rows.map((row) => ({
    productionOrderId: row.productionOrderId,

    status: row.status,
    batchQuantity: row.batchQuantity,

    recipe: {
      id: row.recipeId,
      code: row.recipeCode,
      name: row.recipeName,
    },

    location: {
      id: row.locationId,
      code: row.locationCode,
      name: row.locationName,
    },

    responsible: {
      membershipId: row.responsibleMembershipId,

      name: row.responsibleName,
    },

    outputs: outputMap.get(row.productionOrderId) ?? [],

    plannedFor: row.plannedFor,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,

    inputCount: Number(row.inputCount),
    outputCount: Number(row.outputCount),

    expectedInputCostAtActualRate: row.expectedInputCostAtActualRate,

    actualInputCost: row.actualInputCost,

    inputCostDifference: row.inputCostDifference,

    inputCostVariationPercentage: row.inputCostVariationPercentage,

    declaredWasteCost: row.declaredWasteCost,

    totalResourceCost: row.totalResourceCost,

    producedInventoryValue: row.producedInventoryValue,

    performanceAvailable: row.status === "COMPLETED",
  }));

  return {
    orders,

    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,

      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

export { buildProductionReportWhere, findProductionOrderHistory };
