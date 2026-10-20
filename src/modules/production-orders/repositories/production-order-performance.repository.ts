import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type { InventoryUnit } from "../../inventory-items/inventory-item.types";

import type {
  ProductionOrderPerformanceSource,
  ProductionPerformanceInputSource,
  ProductionPerformanceOutputSource,
} from "../production-order-performance.types";

import type { ProductionOrderStatus } from "../production-order.types";

type PerformanceHeaderRow = RowDataPacket & {
  productionOrderId: string;
  businessId: string;

  status: ProductionOrderStatus;
  batchQuantity: string;

  recipeId: string;
  recipeCode: string;
  recipeName: string;

  locationId: string;
  locationCode: string;
  locationName: string;

  inventoryMovementId: string | null;

  plannedFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;

  completedByMembershipId: string | null;
  completedByName: string | null;
};

type PerformanceInputRow = RowDataPacket & {
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  baseUnit: InventoryUnit;

  plannedQuantity: string;
  actualQuantity: string | null;

  actualUnitCost: string | null;
  actualTotalCost: string | null;

  declaredWasteQuantity: string;
  declaredWasteCost: string;
};

type PerformanceOutputRow = PerformanceInputRow & {
  costAllocationPercentage: string;
};

const wasteTotalsJoin = `
  LEFT JOIN (
    SELECT
      waste.business_id,
      waste.production_order_id,
      iml.inventory_item_id,

      SUM(iml.quantity)
        AS declared_waste_quantity,

      SUM(iml.total_cost)
        AS declared_waste_cost

    FROM production_order_waste_records AS waste

    INNER JOIN inventory_movement_lines AS iml
      ON iml.business_id = waste.business_id
      AND iml.movement_id =
        waste.inventory_movement_id

    GROUP BY
      waste.business_id,
      waste.production_order_id,
      iml.inventory_item_id
  ) AS waste_totals
    ON waste_totals.business_id =
      order_line.business_id

    AND waste_totals.production_order_id =
      order_line.production_order_id

    AND waste_totals.inventory_item_id =
      order_line.inventory_item_id
`;

const findProductionOrderPerformanceSource = async (
  businessId: string,
  productionOrderId: string,
): Promise<ProductionOrderPerformanceSource | null> => {
  const [headerRows] = await databasePool.execute<PerformanceHeaderRow[]>(
    `
          SELECT
            CAST(po.id AS CHAR)
              AS productionOrderId,

            CAST(po.business_id AS CHAR)
              AS businessId,

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

            bl.code AS locationCode,
            bl.name AS locationName,

            CAST(po.inventory_movement_id AS CHAR)
              AS inventoryMovementId,

            po.planned_for AS plannedFor,
            po.started_at AS startedAt,
            po.completed_at AS completedAt,

            CAST(
              po.completed_by_membership_id AS CHAR
            ) AS completedByMembershipId,

            completed_user.full_name
              AS completedByName

          FROM production_orders AS po

          INNER JOIN business_locations AS bl
            ON bl.business_id = po.business_id
            AND bl.id = po.location_id

          LEFT JOIN business_memberships
            AS completed_membership

            ON completed_membership.business_id =
              po.business_id

            AND completed_membership.id =
              po.completed_by_membership_id

          LEFT JOIN users AS completed_user
            ON completed_user.id =
              completed_membership.user_id

          WHERE
            po.business_id = ?
            AND po.id = ?

          LIMIT 1
        `,
    [businessId, productionOrderId],
  );

  const header = headerRows[0];

  if (!header) {
    return null;
  }

  const [inputResult, outputResult] = await Promise.all([
    databasePool.execute<PerformanceInputRow[]>(
      `
            SELECT
              CAST(
                order_line.inventory_item_id
                AS CHAR
              ) AS inventoryItemId,

              order_line.item_name_snapshot
                AS inventoryItemName,

              order_line.item_sku_snapshot
                AS inventoryItemSku,

              order_line.base_unit_snapshot
                AS baseUnit,

              CAST(
                order_line.planned_quantity
                AS CHAR
              ) AS plannedQuantity,

              CAST(
                order_line.actual_quantity
                AS CHAR
              ) AS actualQuantity,

              CAST(
                movement_line.unit_cost
                AS CHAR
              ) AS actualUnitCost,

              CAST(
                movement_line.total_cost
                AS CHAR
              ) AS actualTotalCost,

              CAST(
                COALESCE(
                  waste_totals.declared_waste_quantity,
                  0.000
                )
                AS CHAR
              ) AS declaredWasteQuantity,

              CAST(
                COALESCE(
                  waste_totals.declared_waste_cost,
                  0.000000
                )
                AS CHAR
              ) AS declaredWasteCost

            FROM production_order_inputs
              AS order_line

            INNER JOIN production_orders AS po
              ON po.business_id =
                order_line.business_id

              AND po.id =
                order_line.production_order_id

            LEFT JOIN inventory_movement_lines
              AS movement_line

              ON movement_line.business_id =
                po.business_id

              AND movement_line.movement_id =
                po.inventory_movement_id

              AND movement_line.inventory_item_id =
                order_line.inventory_item_id

              AND movement_line.direction = 'OUT'

            ${wasteTotalsJoin}

            WHERE
              order_line.business_id = ?
              AND order_line.production_order_id = ?

            ORDER BY order_line.id ASC
          `,
      [businessId, productionOrderId],
    ),

    databasePool.execute<PerformanceOutputRow[]>(
      `
            SELECT
              CAST(
                order_line.inventory_item_id
                AS CHAR
              ) AS inventoryItemId,

              order_line.item_name_snapshot
                AS inventoryItemName,

              order_line.item_sku_snapshot
                AS inventoryItemSku,

              order_line.base_unit_snapshot
                AS baseUnit,

              CAST(
                order_line.planned_quantity
                AS CHAR
              ) AS plannedQuantity,

              CAST(
                order_line.actual_quantity
                AS CHAR
              ) AS actualQuantity,

              CAST(
                order_line.cost_allocation_percentage
                AS CHAR
              ) AS costAllocationPercentage,

              CAST(
                movement_line.unit_cost
                AS CHAR
              ) AS actualUnitCost,

              CAST(
                movement_line.total_cost
                AS CHAR
              ) AS actualTotalCost,

              CAST(
                COALESCE(
                  waste_totals.declared_waste_quantity,
                  0.000
                )
                AS CHAR
              ) AS declaredWasteQuantity,

              CAST(
                COALESCE(
                  waste_totals.declared_waste_cost,
                  0.000000
                )
                AS CHAR
              ) AS declaredWasteCost

            FROM production_order_outputs
              AS order_line

            INNER JOIN production_orders AS po
              ON po.business_id =
                order_line.business_id

              AND po.id =
                order_line.production_order_id

            LEFT JOIN inventory_movement_lines
              AS movement_line

              ON movement_line.business_id =
                po.business_id

              AND movement_line.movement_id =
                po.inventory_movement_id

              AND movement_line.inventory_item_id =
                order_line.inventory_item_id

              AND movement_line.direction = 'IN'

            ${wasteTotalsJoin}

            WHERE
              order_line.business_id = ?
              AND order_line.production_order_id = ?

            ORDER BY order_line.id ASC
          `,
      [businessId, productionOrderId],
    ),
  ]);

  const inputs: ProductionPerformanceInputSource[] = inputResult[0].map(
    (row) => ({
      inventoryItemId: row.inventoryItemId,

      inventoryItemName: row.inventoryItemName,

      inventoryItemSku: row.inventoryItemSku,

      baseUnit: row.baseUnit,

      plannedQuantity: row.plannedQuantity,

      actualQuantity: row.actualQuantity,

      actualUnitCost: row.actualUnitCost,

      actualTotalCost: row.actualTotalCost,

      declaredWasteQuantity: row.declaredWasteQuantity,

      declaredWasteCost: row.declaredWasteCost,
    }),
  );

  const outputs: ProductionPerformanceOutputSource[] = outputResult[0].map(
    (row) => ({
      inventoryItemId: row.inventoryItemId,

      inventoryItemName: row.inventoryItemName,

      inventoryItemSku: row.inventoryItemSku,

      baseUnit: row.baseUnit,

      plannedQuantity: row.plannedQuantity,

      actualQuantity: row.actualQuantity,

      costAllocationPercentage: row.costAllocationPercentage,

      actualUnitCost: row.actualUnitCost,

      actualTotalCost: row.actualTotalCost,

      declaredWasteQuantity: row.declaredWasteQuantity,

      declaredWasteCost: row.declaredWasteCost,
    }),
  );

  return {
    productionOrderId: header.productionOrderId,

    businessId: header.businessId,

    status: header.status,
    batchQuantity: header.batchQuantity,

    recipeId: header.recipeId,
    recipeCode: header.recipeCode,
    recipeName: header.recipeName,

    locationId: header.locationId,
    locationCode: header.locationCode,
    locationName: header.locationName,

    inventoryMovementId: header.inventoryMovementId,

    plannedFor: header.plannedFor,
    startedAt: header.startedAt,
    completedAt: header.completedAt,

    completedByMembershipId: header.completedByMembershipId,

    completedByName: header.completedByName,

    inputs,
    outputs,
  };
};

export { findProductionOrderPerformanceSource };
