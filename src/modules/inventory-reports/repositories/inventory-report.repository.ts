import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type {
  InventoryItemType,
  InventoryUnit,
} from "../../inventory-items/inventory-item.types";

import type {
  InventoryMovementCostStatus,
  InventoryMovementDirection,
  InventoryMovementType,
  InventoryReturnKind,
} from "../../inventory-movements/inventory-movement.types";

import type {
  InventoryKardexItem,
  InventoryKardexResult,
  InventoryPurchaseHistoryItem,
  InventoryPurchaseHistoryResult,
  InventoryReportFilters,
  InventorySummary,
  InventorySummaryByLocation,
  UnvaluedInventoryItem,
} from "../inventory-report.types";

type QueryValue = string | number;

type CountRow = RowDataPacket & {
  total: string;
};

type SummaryRow = RowDataPacket & {
  locationCount: string;
  balanceCount: string;
  inStockCount: string;
  lowStockCount: string;
  outOfStockCount: string;
  unvaluedStockCount: string;
  totalInventoryValue: string | null;
};

type SummaryByLocationRow = RowDataPacket & {
  locationId: string;
  locationCode: string;
  locationName: string;
  balanceCount: string;
  unvaluedStockCount: string;
  totalInventoryValue: string | null;
};

type UnvaluedRow = RowDataPacket & {
  inventoryItemId: string;
  sku: string | null;
  name: string;
  itemType: InventoryItemType;
  baseUnit: InventoryUnit;

  locationId: string;
  locationCode: string;
  locationName: string;

  currentStock: string;
  minimumStock: string;
  migratedFromLegacy: number;
  updatedAt: Date;
};

type KardexRow = RowDataPacket & {
  movementLineId: string;
  movementId: string;

  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;

  inventoryItemId: string;
  sku: string | null;
  inventoryItemName: string;
  baseUnit: InventoryUnit;

  movementType: InventoryMovementType;
  returnKind: InventoryReturnKind | null;

  direction: InventoryMovementDirection;
  quantity: string;

  balanceBefore: string;
  balanceAfter: string;

  unitCost: string | null;
  totalCost: string | null;

  averageUnitCostBefore: string | null;
  averageUnitCostAfter: string | null;

  inventoryValueBefore: string | null;
  inventoryValueAfter: string | null;

  costStatus: InventoryMovementCostStatus;

  externalReference: string | null;
  notes: string | null;

  createdByMembershipId: string;
  createdByName: string;
  createdAt: Date;
};

type PurchaseRow = RowDataPacket & {
  movementId: string;
  movementLineId: string;

  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;

  supplierName: string | null;
  supplierDocument: string | null;
  externalReference: string | null;
  documentDate: string | null;

  inventoryItemId: string;
  sku: string | null;
  inventoryItemName: string;
  baseUnit: InventoryUnit;

  presentationName: string | null;
  purchasedQuantity: string | null;
  baseQuantity: string;

  grossCost: string | null;
  discountAmount: string | null;
  additionalCostAmount: string | null;
  netCost: string | null;

  purchaseUnitCost: string | null;
  previousAverageUnitCost: string | null;
  newAverageUnitCost: string | null;
  averageCostVariationPercentage: string | null;

  costStatus: InventoryMovementCostStatus;

  createdByName: string;
  createdAt: Date;
};

const locationFromRow = (row: {
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
}) =>
  row.locationId && row.locationCode && row.locationName
    ? {
        id: row.locationId,
        code: row.locationCode,
        name: row.locationName,
      }
    : null;

const createBalanceWhere = (businessId: string, locationId?: string) => {
  const conditions = ["ilb.business_id = ?"];
  const values: QueryValue[] = [businessId];

  if (locationId !== undefined) {
    conditions.push("ilb.location_id = ?");
    values.push(locationId);
  }

  return {
    sql: conditions.join("\nAND "),
    values,
  };
};

const createMovementWhere = (
  businessId: string,
  filters: InventoryReportFilters,
  purchaseOnly: boolean,
) => {
  const conditions = ["im.business_id = ?"];
  const values: QueryValue[] = [businessId];

  if (purchaseOnly) {
    conditions.push("im.movement_type = 'PURCHASE'");
  }

  if (filters.period) {
    conditions.push("im.created_at >= ?");
    conditions.push("im.created_at < ?");

    values.push(filters.period.start, filters.period.end);
  }

  if (filters.locationId !== undefined) {
    conditions.push("im.location_id = ?");
    values.push(filters.locationId);
  }

  if (filters.inventoryItemId !== undefined) {
    conditions.push("iml.inventory_item_id = ?");
    values.push(filters.inventoryItemId);
  }

  if (!purchaseOnly && filters.movementType !== undefined) {
    conditions.push("im.movement_type = ?");
    values.push(filters.movementType);
  }

  return {
    sql: conditions.join("\nAND "),
    values,
  };
};

const findInventorySummary = async (
  businessId: string,
  locationId?: string,
): Promise<InventorySummary> => {
  const where = createBalanceWhere(businessId, locationId);

  const [rows] = await databasePool.execute<SummaryRow[]>(
    `
        SELECT
          CAST(
            COUNT(DISTINCT ilb.location_id)
            AS CHAR
          ) AS locationCount,

          CAST(COUNT(*) AS CHAR)
            AS balanceCount,

          CAST(
            COALESCE(
              SUM(ilb.current_stock > 0),
              0
            )
            AS CHAR
          ) AS inStockCount,

          CAST(
            COALESCE(
              SUM(
                ilb.current_stock > 0
                AND ilb.current_stock
                    <= ilb.minimum_stock
              ),
              0
            )
            AS CHAR
          ) AS lowStockCount,

          CAST(
            COALESCE(
              SUM(ilb.current_stock <= 0),
              0
            )
            AS CHAR
          ) AS outOfStockCount,

          CAST(
            COALESCE(
              SUM(
                ilb.valuation_status = 'UNVALUED'
                AND ilb.current_stock <> 0
              ),
              0
            )
            AS CHAR
          ) AS unvaluedStockCount,

          CAST(
            CASE
              WHEN SUM(
                ilb.valuation_status = 'UNVALUED'
                AND ilb.current_stock <> 0
              ) > 0
                THEN NULL
              ELSE COALESCE(
                SUM(ilb.inventory_value),
                0
              )
            END
            AS CHAR
          ) AS totalInventoryValue

        FROM inventory_location_balances AS ilb

        WHERE ${where.sql}
      `,
    [...where.values],
  );

  const row = rows[0];

  const unvaluedStockCount = Number(row?.unvaluedStockCount ?? 0);

  return {
    locationCount: Number(row?.locationCount ?? 0),
    balanceCount: Number(row?.balanceCount ?? 0),
    inStockCount: Number(row?.inStockCount ?? 0),
    lowStockCount: Number(row?.lowStockCount ?? 0),
    outOfStockCount: Number(row?.outOfStockCount ?? 0),
    unvaluedStockCount,
    totalInventoryValue: row?.totalInventoryValue ?? null,
    hasUnvaluedStock: unvaluedStockCount > 0,
  };
};

const findInventorySummaryByLocation = async (
  businessId: string,
): Promise<InventorySummaryByLocation[]> => {
  const [rows] = await databasePool.execute<SummaryByLocationRow[]>(
    `
        SELECT
          CAST(bl.id AS CHAR) AS locationId,
          bl.code AS locationCode,
          bl.name AS locationName,

          CAST(COUNT(*) AS CHAR)
            AS balanceCount,

          CAST(
            COALESCE(
              SUM(
                ilb.valuation_status = 'UNVALUED'
                AND ilb.current_stock <> 0
              ),
              0
            )
            AS CHAR
          ) AS unvaluedStockCount,

          CAST(
            CASE
              WHEN SUM(
                ilb.valuation_status = 'UNVALUED'
                AND ilb.current_stock <> 0
              ) > 0
                THEN NULL
              ELSE COALESCE(
                SUM(ilb.inventory_value),
                0
              )
            END
            AS CHAR
          ) AS totalInventoryValue

        FROM business_locations AS bl

        INNER JOIN inventory_location_balances AS ilb
          ON ilb.business_id = bl.business_id
          AND ilb.location_id = bl.id

        WHERE
          bl.business_id = ?
          AND bl.is_inventory_location = TRUE

        GROUP BY
          bl.id,
          bl.code,
          bl.name

        ORDER BY
          bl.name ASC,
          bl.id ASC
      `,
    [businessId],
  );

  return rows.map((row) => ({
    location: {
      id: row.locationId,
      code: row.locationCode,
      name: row.locationName,
    },
    balanceCount: Number(row.balanceCount),
    unvaluedStockCount: Number(row.unvaluedStockCount),
    totalInventoryValue: row.totalInventoryValue,
  }));
};

const findUnvaluedInventoryItems = async (
  businessId: string,
  locationId?: string,
): Promise<UnvaluedInventoryItem[]> => {
  const where = createBalanceWhere(businessId, locationId);

  const [rows] = await databasePool.execute<UnvaluedRow[]>(
    `
        SELECT
          CAST(ii.id AS CHAR) AS inventoryItemId,
          ii.sku,
          ii.name,
          ii.item_type AS itemType,
          ii.base_unit AS baseUnit,

          CAST(bl.id AS CHAR) AS locationId,
          bl.code AS locationCode,
          bl.name AS locationName,

          CAST(ilb.current_stock AS CHAR)
            AS currentStock,

          CAST(ilb.minimum_stock AS CHAR)
            AS minimumStock,

          ilb.migrated_from_legacy
            AS migratedFromLegacy,

          ilb.updated_at AS updatedAt

        FROM inventory_location_balances AS ilb

        INNER JOIN inventory_items AS ii
          ON ii.business_id = ilb.business_id
          AND ii.id = ilb.inventory_item_id

        INNER JOIN business_locations AS bl
          ON bl.business_id = ilb.business_id
          AND bl.id = ilb.location_id

        WHERE
          ${where.sql}
          AND ilb.valuation_status = 'UNVALUED'
          AND ilb.current_stock <> 0

        ORDER BY
          bl.name ASC,
          ii.name ASC,
          ii.id ASC
      `,
    [...where.values],
  );

  return rows.map((row) => ({
    inventoryItemId: row.inventoryItemId,
    sku: row.sku,
    name: row.name,
    itemType: row.itemType,
    baseUnit: row.baseUnit,

    location: {
      id: row.locationId,
      code: row.locationCode,
      name: row.locationName,
    },

    currentStock: row.currentStock,
    minimumStock: row.minimumStock,
    migratedFromLegacy: Boolean(row.migratedFromLegacy),
    updatedAt: row.updatedAt,
  }));
};

const findInventoryKardex = async (
  businessId: string,
  filters: InventoryReportFilters,
): Promise<InventoryKardexResult> => {
  const where = createMovementWhere(businessId, filters, false);

  const [countRows] = await databasePool.execute<CountRow[]>(
    `
        SELECT CAST(COUNT(*) AS CHAR) AS total
        FROM inventory_movement_lines AS iml
        INNER JOIN inventory_movements AS im
          ON im.business_id = iml.business_id
          AND im.id = iml.movement_id
        WHERE ${where.sql}
      `,
    [...where.values],
  );

  const total = Number(countRows[0]?.total ?? 0);
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows] = await databasePool.execute<KardexRow[]>(
    `
        SELECT
          CAST(iml.id AS CHAR)
            AS movementLineId,

          CAST(im.id AS CHAR)
            AS movementId,

          CAST(bl.id AS CHAR)
            AS locationId,

          bl.code AS locationCode,
          bl.name AS locationName,

          CAST(ii.id AS CHAR)
            AS inventoryItemId,

          ii.sku,
          ii.name AS inventoryItemName,
          ii.base_unit AS baseUnit,

          im.movement_type AS movementType,
          im.return_kind AS returnKind,

          iml.direction,

          CAST(iml.quantity AS CHAR)
            AS quantity,

          CAST(iml.balance_before AS CHAR)
            AS balanceBefore,

          CAST(iml.balance_after AS CHAR)
            AS balanceAfter,

          CAST(iml.unit_cost AS CHAR)
            AS unitCost,

          CAST(iml.total_cost AS CHAR)
            AS totalCost,

          CAST(iml.average_unit_cost_before AS CHAR)
            AS averageUnitCostBefore,

          CAST(iml.average_unit_cost_after AS CHAR)
            AS averageUnitCostAfter,

          CAST(iml.inventory_value_before AS CHAR)
            AS inventoryValueBefore,

          CAST(iml.inventory_value_after AS CHAR)
            AS inventoryValueAfter,

          iml.cost_status AS costStatus,

          im.external_reference AS externalReference,
          iml.notes,

          CAST(im.created_by_membership_id AS CHAR)
            AS createdByMembershipId,

          u.full_name AS createdByName,
          im.created_at AS createdAt

        FROM inventory_movement_lines AS iml

        INNER JOIN inventory_movements AS im
          ON im.business_id = iml.business_id
          AND im.id = iml.movement_id

        INNER JOIN inventory_items AS ii
          ON ii.business_id = iml.business_id
          AND ii.id = iml.inventory_item_id

        LEFT JOIN business_locations AS bl
          ON bl.business_id = im.business_id
          AND bl.id = im.location_id

        INNER JOIN business_memberships AS bm
          ON bm.business_id = im.business_id
          AND bm.id = im.created_by_membership_id

        INNER JOIN users AS u
          ON u.id = bm.user_id

        WHERE ${where.sql}

        ORDER BY
          im.created_at DESC,
          im.id DESC,
          iml.id DESC

        LIMIT ?
        OFFSET ?
      `,
    [...where.values, filters.pageSize, offset],
  );

  const entries: InventoryKardexItem[] = rows.map((row) => ({
    movementLineId: row.movementLineId,
    movementId: row.movementId,

    location: locationFromRow(row),

    inventoryItemId: row.inventoryItemId,
    sku: row.sku,
    inventoryItemName: row.inventoryItemName,
    baseUnit: row.baseUnit,

    movementType: row.movementType,
    returnKind: row.returnKind,

    direction: row.direction,
    quantity: row.quantity,

    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,

    unitCost: row.unitCost,
    totalCost: row.totalCost,

    averageUnitCostBefore: row.averageUnitCostBefore,

    averageUnitCostAfter: row.averageUnitCostAfter,

    inventoryValueBefore: row.inventoryValueBefore,

    inventoryValueAfter: row.inventoryValueAfter,

    costStatus: row.costStatus,

    externalReference: row.externalReference,

    notes: row.notes,

    createdByMembershipId: row.createdByMembershipId,

    createdByName: row.createdByName,
    createdAt: row.createdAt,
  }));

  return {
    entries,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

const findInventoryPurchaseHistory = async (
  businessId: string,
  filters: InventoryReportFilters,
): Promise<InventoryPurchaseHistoryResult> => {
  const where = createMovementWhere(businessId, filters, true);

  const [countRows] = await databasePool.execute<CountRow[]>(
    `
        SELECT CAST(COUNT(*) AS CHAR) AS total
        FROM inventory_movement_lines AS iml
        INNER JOIN inventory_movements AS im
          ON im.business_id = iml.business_id
          AND im.id = iml.movement_id
        WHERE ${where.sql}
      `,
    [...where.values],
  );

  const total = Number(countRows[0]?.total ?? 0);
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows] = await databasePool.execute<PurchaseRow[]>(
    `
        SELECT
          CAST(im.id AS CHAR) AS movementId,
          CAST(iml.id AS CHAR) AS movementLineId,

          CAST(bl.id AS CHAR) AS locationId,
          bl.code AS locationCode,
          bl.name AS locationName,

          im.supplier_name AS supplierName,
          im.supplier_document AS supplierDocument,
          im.external_reference AS externalReference,

          DATE_FORMAT(im.document_date, '%Y-%m-%d')
            AS documentDate,

          CAST(ii.id AS CHAR) AS inventoryItemId,
          ii.sku,
          ii.name AS inventoryItemName,
          ii.base_unit AS baseUnit,

          iml.purchase_presentation_name
            AS presentationName,

          CAST(iml.purchased_quantity AS CHAR)
            AS purchasedQuantity,

          CAST(iml.quantity AS CHAR)
            AS baseQuantity,

          CAST(iml.gross_cost AS CHAR)
            AS grossCost,

          CAST(iml.discount_amount AS CHAR)
            AS discountAmount,

          CAST(iml.additional_cost_amount AS CHAR)
            AS additionalCostAmount,

          CAST(iml.total_cost AS CHAR)
            AS netCost,

          CAST(iml.unit_cost AS CHAR)
            AS purchaseUnitCost,

          CAST(iml.average_unit_cost_before AS CHAR)
            AS previousAverageUnitCost,

          CAST(iml.average_unit_cost_after AS CHAR)
            AS newAverageUnitCost,

          CAST(
            CASE
              WHEN iml.average_unit_cost_before IS NULL
                OR iml.average_unit_cost_before = 0
                THEN NULL
              ELSE ROUND(
                (
                  iml.average_unit_cost_after
                  - iml.average_unit_cost_before
                )
                / iml.average_unit_cost_before
                * 100,
                2
              )
            END
            AS CHAR
          ) AS averageCostVariationPercentage,

          iml.cost_status AS costStatus,

          u.full_name AS createdByName,
          im.created_at AS createdAt

        FROM inventory_movement_lines AS iml

        INNER JOIN inventory_movements AS im
          ON im.business_id = iml.business_id
          AND im.id = iml.movement_id

        INNER JOIN inventory_items AS ii
          ON ii.business_id = iml.business_id
          AND ii.id = iml.inventory_item_id

        LEFT JOIN business_locations AS bl
          ON bl.business_id = im.business_id
          AND bl.id = im.location_id

        INNER JOIN business_memberships AS bm
          ON bm.business_id = im.business_id
          AND bm.id = im.created_by_membership_id

        INNER JOIN users AS u
          ON u.id = bm.user_id

        WHERE ${where.sql}

        ORDER BY
          im.created_at DESC,
          im.id DESC,
          iml.id DESC

        LIMIT ?
        OFFSET ?
      `,
    [...where.values, filters.pageSize, offset],
  );

  const purchases: InventoryPurchaseHistoryItem[] = rows.map((row) => ({
    movementId: row.movementId,
    movementLineId: row.movementLineId,

    location: locationFromRow(row),

    supplierName: row.supplierName,
    supplierDocument: row.supplierDocument,

    externalReference: row.externalReference,

    documentDate: row.documentDate,

    inventoryItemId: row.inventoryItemId,

    sku: row.sku,
    inventoryItemName: row.inventoryItemName,

    baseUnit: row.baseUnit,

    presentationName: row.presentationName,

    purchasedQuantity: row.purchasedQuantity,

    baseQuantity: row.baseQuantity,

    grossCost: row.grossCost,
    discountAmount: row.discountAmount,

    additionalCostAmount: row.additionalCostAmount,

    netCost: row.netCost,

    purchaseUnitCost: row.purchaseUnitCost,

    previousAverageUnitCost: row.previousAverageUnitCost,

    newAverageUnitCost: row.newAverageUnitCost,

    averageCostVariationPercentage: row.averageCostVariationPercentage,

    costStatus: row.costStatus,

    createdByName: row.createdByName,
    createdAt: row.createdAt,
  }));

  return {
    purchases,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

export {
  findInventoryKardex,
  findInventoryPurchaseHistory,
  findInventorySummary,
  findInventorySummaryByLocation,
  findUnvaluedInventoryItems,
};
