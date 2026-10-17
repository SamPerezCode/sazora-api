import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import { AppError } from "../../../shared/errors/app-error";

import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";
import type {
  CreateInventoryItemData,
  InventoryItem,
  InventoryItemType,
  InventoryStockStatus,
  InventoryUnit,
  UpdateInventoryItemData,
} from "../inventory-item.types";

type InventoryItemRow = RowDataPacket & {
  id: string;
  businessId: string;
  sku: string | null;
  name: string;
  itemType: InventoryItemType;
  baseUnit: InventoryUnit;
  currentStock: string;
  minimumStock: string;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type InventoryLocationRow = RowDataPacket & {
  isActive: number;
  isInventoryLocation: number;
};

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

const mapInventoryItemRow = (row: InventoryItemRow): InventoryItem => ({
  id: row.id,
  businessId: row.businessId,
  sku: row.sku,
  name: row.name,
  itemType: row.itemType,
  baseUnit: row.baseUnit,
  currentStock: row.currentStock,
  minimumStock: row.minimumStock,
  stockStatus: getStockStatus(row.currentStock, row.minimumStock),
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const inventoryItemSelect = `
  SELECT
    CAST(id AS CHAR) AS id,
    CAST(business_id AS CHAR) AS businessId,
    sku,
    name,
    item_type AS itemType,
    base_unit AS baseUnit,
    CAST(current_stock AS CHAR) AS currentStock,
    CAST(minimum_stock AS CHAR) AS minimumStock,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM inventory_items
`;

const findInventoryItemById = async (
  businessId: string,
  inventoryItemId: string,
): Promise<InventoryItem | null> => {
  const [rows] = await databasePool.execute<InventoryItemRow[]>(
    `
      ${inventoryItemSelect}
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, inventoryItemId],
  );

  return rows[0] ? mapInventoryItemRow(rows[0]) : null;
};

const findInventoryItems = async (
  businessId: string,
): Promise<InventoryItem[]> => {
  const [rows] = await databasePool.execute<InventoryItemRow[]>(
    `
      ${inventoryItemSelect}
      WHERE business_id = ?
      ORDER BY
        is_active DESC,
        name ASC,
        id ASC
    `,
    [businessId],
  );

  return rows.map(mapInventoryItemRow);
};

const insertInventoryItem = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryItemData,
): Promise<InventoryItem> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [locationRows] = await connection.execute<InventoryLocationRow[]>(
      `
          SELECT
            is_active AS isActive,
            is_inventory_location AS isInventoryLocation
          FROM business_locations
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, data.locationId],
    );

    const location = locationRows[0];

    if (!location) {
      throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
    }

    if (location.isActive !== 1) {
      throw new AppError(
        "La ubicación está inactiva",
        409,
        "LOCATION_INACTIVE",
      );
    }

    if (location.isInventoryLocation !== 1) {
      throw new AppError(
        "La ubicación no está habilitada para inventario",
        409,
        "LOCATION_NOT_INVENTORY_ENABLED",
      );
    }

    const [itemResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO inventory_items (
            business_id,
            sku,
            name,
            item_type,
            base_unit,
            current_stock,
            minimum_stock
          )
          VALUES (?, ?, ?, ?, ?, 0.000, ?)
        `,
      [
        businessId,
        data.sku,
        data.name,
        data.itemType,
        data.baseUnit,
        data.minimumStock,
      ],
    );

    const inventoryItemId = itemResult.insertId.toString();

    /*
     * Creamos el saldo incluso si la existencia inicial es cero.
     * Así el artículo queda configurado para la ubicación y conserva
     * su stock mínimo local.
     */
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO inventory_location_balances (
          business_id,
          location_id,
          inventory_item_id,
          current_stock,
          minimum_stock,
          average_unit_cost,
          inventory_value,
          valuation_status,
          migrated_from_legacy
        )
        VALUES (
          ?,
          ?,
          ?,
          0.000,
          ?,
          NULL,
          0.000000,
          'VALUED',
          FALSE
        )
      `,
      [businessId, data.locationId, inventoryItemId, data.minimumStock],
    );

    if (Number(data.openingQuantity) > 0) {
      const movementResult = await applyLocationInventoryMovement(
        connection,
        businessId,
        membershipId,
        {
          locationId: data.locationId,
          movementType: "OPENING",
          returnKind: null,
          sourceType: "INVENTORY_ITEM",
          sourceId: inventoryItemId,
          externalReference: null,
          notes: "Existencia inicial",
          lines: [
            {
              inventoryItemId,
              direction: "IN",
              quantity: data.openingQuantity,
              unitCost: data.openingUnitCost,
              totalCost: null,
              notes: "Existencia inicial",
            },
          ],
        },
      );

      if (movementResult.kind !== "APPLIED") {
        throw new Error(
          `No fue posible registrar la existencia inicial: ` +
            movementResult.kind,
        );
      }
    }

    await connection.commit();

    const item = await findInventoryItemById(businessId, inventoryItemId);

    if (!item) {
      throw new Error("No fue posible recuperar el artículo creado");
    }

    return item;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateInventoryItemById = async (
  businessId: string,
  inventoryItemId: string,
  data: UpdateInventoryItemData,
): Promise<InventoryItem | null> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [currentRows] = await connection.execute<InventoryItemRow[]>(
      `
          ${inventoryItemSelect}

          WHERE
            business_id = ?
            AND id = ?

          LIMIT 1
          FOR UPDATE
        `,
      [businessId, inventoryItemId],
    );

    const current = currentRows[0];

    if (!current) {
      await connection.rollback();
      return null;
    }

    /*
     * Los datos generales continúan perteneciendo al catálogo
     * del negocio y no a una sede específica.
     */
    await connection.execute<ResultSetHeader>(
      `
        UPDATE inventory_items
        SET
          sku = ?,
          name = ?,
          item_type = ?,
          base_unit = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        data.sku !== undefined ? data.sku : current.sku,

        data.name ?? current.name,

        data.itemType ?? current.itemType,

        data.baseUnit ?? current.baseUnit,

        businessId,
        inventoryItemId,
      ],
    );

    if (data.minimumStock !== undefined && data.locationId !== undefined) {
      const [minimumStockResult] = await connection.execute<ResultSetHeader>(
        `
            UPDATE inventory_location_balances
            SET minimum_stock = ?
            WHERE
              business_id = ?
              AND location_id = ?
              AND inventory_item_id = ?
          `,
        [data.minimumStock, businessId, data.locationId, inventoryItemId],
      );

      if (minimumStockResult.affectedRows === 0) {
        throw new AppError(
          "El artículo no está configurado en la ubicación indicada",
          404,
          "INVENTORY_LOCATION_BALANCE_NOT_FOUND",
        );
      }

      /*
       * Compatibilidad temporal:
       *
       * inventory_items.minimum_stock representa el mínimo
       * consolidado de todas las ubicaciones.
       */
      await connection.execute<ResultSetHeader>(
        `
          UPDATE inventory_items AS ii
          SET ii.minimum_stock = (
            SELECT
              COALESCE(
                SUM(ilb.minimum_stock),
                0.000
              )
            FROM inventory_location_balances AS ilb
            WHERE
              ilb.business_id = ii.business_id
              AND ilb.inventory_item_id = ii.id
          )
          WHERE
            ii.business_id = ?
            AND ii.id = ?
        `,
        [businessId, inventoryItemId],
      );
    }

    await connection.commit();

    const updatedItem = await findInventoryItemById(
      businessId,
      inventoryItemId,
    );

    if (!updatedItem) {
      throw new Error("No fue posible recuperar el artículo actualizado");
    }

    return updatedItem;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
const updateInventoryItemStatusById = async (
  businessId: string,
  inventoryItemId: string,
  isActive: boolean,
): Promise<InventoryItem | null> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
        UPDATE inventory_items
        SET is_active = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
    [isActive, businessId, inventoryItemId],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findInventoryItemById(businessId, inventoryItemId);
};

export {
  findInventoryItemById,
  findInventoryItems,
  insertInventoryItem,
  updateInventoryItemById,
  updateInventoryItemStatusById,
};
