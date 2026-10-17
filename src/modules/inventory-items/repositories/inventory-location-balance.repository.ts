import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type {
  InitialInventoryValuationData,
  InventoryLocationBalance,
  InventoryValuationEvent,
} from "../inventory-location-balance.types";

import type {
  InventoryItemType,
  InventoryStockStatus,
  InventoryUnit,
} from "../inventory-item.types";

type InventoryLocationBalanceRow = RowDataPacket & {
  inventoryItemId: string;
  sku: string | null;
  name: string;
  itemType: InventoryItemType;
  baseUnit: InventoryUnit;
  isItemActive: number;

  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: "PRODUCTION_WAREHOUSE" | "POINT_OF_SALE";

  isLocationActive: number;

  currentStock: string;
  minimumStock: string;

  averageUnitCost: string | null;
  inventoryValue: string | null;

  valuationStatus: "UNVALUED" | "VALUED";

  migratedFromLegacy: number;

  createdAt: Date;
  updatedAt: Date;
};

type LockedBalanceRow = RowDataPacket & {
  currentStock: string;
  averageUnitCost: string | null;
  inventoryValue: string | null;
  valuationStatus: "UNVALUED" | "VALUED";
};

type CalculatedValueRow = RowDataPacket & {
  inventoryValue: string;
};

type ValuationEventRow = RowDataPacket & {
  id: string;
  inventoryItemId: string;
  locationId: string;

  eventType: "INITIAL_VALUATION" | "COST_CORRECTION";

  quantitySnapshot: string;

  previousAverageUnitCost: string | null;
  newAverageUnitCost: string;

  previousInventoryValue: string | null;
  newInventoryValue: string;

  reason: string;
  createdByMembershipId: string;
  createdAt: Date;
};

type InitialValuationResult =
  | Readonly<{
      kind: "VALUED";
      balance: InventoryLocationBalance;
      event: InventoryValuationEvent;
    }>
  | Readonly<{
      kind: "BALANCE_NOT_FOUND";
    }>
  | Readonly<{
      kind: "BALANCE_ALREADY_VALUED";
    }>
  | Readonly<{
      kind: "BALANCE_HAS_NO_STOCK";
    }>;

const getStockStatus = (
  currentStock: string,
  minimumStock: string,
): InventoryStockStatus => {
  const current = Number(currentStock);
  const minimum = Number(minimumStock);

  if (current <= 0) {
    return "OUT_OF_STOCK";
  }

  if (current <= minimum) {
    return "LOW_STOCK";
  }

  return "AVAILABLE";
};

const mapBalanceRow = (
  row: InventoryLocationBalanceRow,
): InventoryLocationBalance => ({
  inventoryItemId: row.inventoryItemId,
  sku: row.sku,
  name: row.name,
  itemType: row.itemType,
  baseUnit: row.baseUnit,
  isItemActive: Boolean(row.isItemActive),

  location: {
    id: row.locationId,
    code: row.locationCode,
    name: row.locationName,
    locationType: row.locationType,
    isActive: Boolean(row.isLocationActive),
  },

  currentStock: row.currentStock,
  minimumStock: row.minimumStock,

  stockStatus: getStockStatus(row.currentStock, row.minimumStock),

  averageUnitCost: row.averageUnitCost,
  inventoryValue: row.inventoryValue,
  valuationStatus: row.valuationStatus,

  migratedFromLegacy: Boolean(row.migratedFromLegacy),

  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const balanceSelect = `
  SELECT
    CAST(ii.id AS CHAR)
      AS inventoryItemId,

    ii.sku,
    ii.name,
    ii.item_type AS itemType,
    ii.base_unit AS baseUnit,
    ii.is_active AS isItemActive,

    CAST(bl.id AS CHAR)
      AS locationId,

    bl.code AS locationCode,
    bl.name AS locationName,
    bl.location_type AS locationType,
    bl.is_active AS isLocationActive,

    CAST(ilb.current_stock AS CHAR)
      AS currentStock,

    CAST(ilb.minimum_stock AS CHAR)
      AS minimumStock,

    CAST(ilb.average_unit_cost AS CHAR)
      AS averageUnitCost,

    CAST(ilb.inventory_value AS CHAR)
      AS inventoryValue,

    ilb.valuation_status AS valuationStatus,

    ilb.migrated_from_legacy
      AS migratedFromLegacy,

    ilb.created_at AS createdAt,
    ilb.updated_at AS updatedAt

  FROM inventory_location_balances AS ilb

  INNER JOIN inventory_items AS ii
    ON ii.business_id = ilb.business_id
    AND ii.id = ilb.inventory_item_id

  INNER JOIN business_locations AS bl
    ON bl.business_id = ilb.business_id
    AND bl.id = ilb.location_id
`;

const findInventoryLocationBalances = async (
  businessId: string,
  locationId?: string,
): Promise<InventoryLocationBalance[]> => {
  const conditions = ["ilb.business_id = ?"];
  const values: string[] = [businessId];

  if (locationId !== undefined) {
    conditions.push("ilb.location_id = ?");
    values.push(locationId);
  }

  const [rows] = await databasePool.execute<InventoryLocationBalanceRow[]>(
    `
        ${balanceSelect}

        WHERE ${conditions.join("\nAND ")}

        ORDER BY
          bl.is_active DESC,
          bl.name ASC,
          ii.is_active DESC,
          ii.name ASC,
          ii.id ASC
      `,
    values,
  );

  return rows.map(mapBalanceRow);
};

const findInventoryLocationBalance = async (
  businessId: string,
  locationId: string,
  inventoryItemId: string,
): Promise<InventoryLocationBalance | null> => {
  const [rows] = await databasePool.execute<InventoryLocationBalanceRow[]>(
    `
        ${balanceSelect}

        WHERE
          ilb.business_id = ?
          AND ilb.location_id = ?
          AND ilb.inventory_item_id = ?

        LIMIT 1
      `,
    [businessId, locationId, inventoryItemId],
  );

  return rows[0] ? mapBalanceRow(rows[0]) : null;
};

const findValuationEventById = async (
  connection: PoolConnection,
  businessId: string,
  valuationEventId: string,
): Promise<InventoryValuationEvent> => {
  const [rows] = await connection.execute<ValuationEventRow[]>(
    `
        SELECT
          CAST(id AS CHAR) AS id,

          CAST(inventory_item_id AS CHAR)
            AS inventoryItemId,

          CAST(location_id AS CHAR)
            AS locationId,

          event_type AS eventType,

          CAST(quantity_snapshot AS CHAR)
            AS quantitySnapshot,

          CAST(previous_average_unit_cost AS CHAR)
            AS previousAverageUnitCost,

          CAST(new_average_unit_cost AS CHAR)
            AS newAverageUnitCost,

          CAST(previous_inventory_value AS CHAR)
            AS previousInventoryValue,

          CAST(new_inventory_value AS CHAR)
            AS newInventoryValue,

          reason,

          CAST(created_by_membership_id AS CHAR)
            AS createdByMembershipId,

          created_at AS createdAt

        FROM inventory_valuation_events

        WHERE
          business_id = ?
          AND id = ?

        LIMIT 1
      `,
    [businessId, valuationEventId],
  );

  const event = rows[0];

  if (!event) {
    throw new Error("No fue posible recuperar el evento de valoración");
  }

  return event;
};

const valueInitialInventoryBalance = async (
  businessId: string,
  membershipId: string,
  locationId: string,
  inventoryItemId: string,
  data: InitialInventoryValuationData,
): Promise<InitialValuationResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [balanceRows] = await connection.execute<LockedBalanceRow[]>(
      `
          SELECT
            CAST(current_stock AS CHAR)
              AS currentStock,

            CAST(average_unit_cost AS CHAR)
              AS averageUnitCost,

            CAST(inventory_value AS CHAR)
              AS inventoryValue,

            valuation_status AS valuationStatus

          FROM inventory_location_balances

          WHERE
            business_id = ?
            AND location_id = ?
            AND inventory_item_id = ?

          LIMIT 1
          FOR UPDATE
        `,
      [businessId, locationId, inventoryItemId],
    );

    const balance = balanceRows[0];

    if (!balance) {
      await connection.rollback();

      return {
        kind: "BALANCE_NOT_FOUND",
      };
    }

    if (balance.valuationStatus === "VALUED") {
      await connection.rollback();

      return {
        kind: "BALANCE_ALREADY_VALUED",
      };
    }

    if (Number(balance.currentStock) <= 0) {
      await connection.rollback();

      return {
        kind: "BALANCE_HAS_NO_STOCK",
      };
    }

    const [calculatedRows] = await connection.execute<CalculatedValueRow[]>(
      `
          SELECT
            CAST(
              ROUND(
                CAST(? AS DECIMAL(18, 3))
                *
                CAST(? AS DECIMAL(24, 6)),
                6
              )
              AS CHAR
            ) AS inventoryValue
        `,
      [balance.currentStock, data.unitCost],
    );

    const calculatedValue = calculatedRows[0]?.inventoryValue;

    if (!calculatedValue) {
      throw new Error("No fue posible calcular el valor del inventario");
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE inventory_location_balances

        SET
          average_unit_cost = ?,
          inventory_value = ?,
          valuation_status = 'VALUED'

        WHERE
          business_id = ?
          AND location_id = ?
          AND inventory_item_id = ?
          AND valuation_status = 'UNVALUED'
      `,
      [data.unitCost, calculatedValue, businessId, locationId, inventoryItemId],
    );

    const [eventResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO inventory_valuation_events (
            business_id,
            location_id,
            inventory_item_id,
            event_type,
            quantity_snapshot,
            previous_average_unit_cost,
            new_average_unit_cost,
            previous_inventory_value,
            new_inventory_value,
            reason,
            created_by_membership_id
          )
          VALUES (
            ?,
            ?,
            ?,
            'INITIAL_VALUATION',
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `,
      [
        businessId,
        locationId,
        inventoryItemId,
        balance.currentStock,
        balance.averageUnitCost,
        data.unitCost,
        balance.inventoryValue,
        calculatedValue,
        data.reason,
        membershipId,
      ],
    );

    const valuationEventId = eventResult.insertId.toString();

    const event = await findValuationEventById(
      connection,
      businessId,
      valuationEventId,
    );

    await connection.commit();

    const updatedBalance = await findInventoryLocationBalance(
      businessId,
      locationId,
      inventoryItemId,
    );

    if (!updatedBalance) {
      throw new Error("No fue posible recuperar el saldo valorado");
    }

    return {
      kind: "VALUED",
      balance: updatedBalance,
      event,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  findInventoryLocationBalance,
  findInventoryLocationBalances,
  valueInitialInventoryBalance,
};

export type { InitialValuationResult };
