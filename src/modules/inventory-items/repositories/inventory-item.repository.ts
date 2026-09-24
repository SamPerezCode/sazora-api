import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
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

    if (Number(data.openingQuantity) > 0) {
      const [movementResult] = await connection.execute<ResultSetHeader>(
        `
            INSERT INTO inventory_movements (
              business_id,
              movement_type,
              source_type,
              source_id,
              notes,
              created_by_membership_id
            )
            VALUES (
              ?,
              'OPENING',
              'INVENTORY_ITEM',
              ?,
              'Existencia inicial',
              ?
            )
          `,
        [businessId, inventoryItemId, membershipId],
      );

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO inventory_movement_lines (
            business_id,
            movement_id,
            inventory_item_id,
            direction,
            quantity,
            balance_before,
            balance_after,
            notes
          )
          VALUES (
            ?,
            ?,
            ?,
            'IN',
            ?,
            0.000,
            ?,
            'Existencia inicial'
          )
        `,
        [
          businessId,
          movementResult.insertId.toString(),
          inventoryItemId,
          data.openingQuantity,
          data.openingQuantity,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE inventory_items
          SET current_stock = ?
          WHERE
            business_id = ?
            AND id = ?
        `,
        [data.openingQuantity, businessId, inventoryItemId],
      );
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
  const current = await findInventoryItemById(businessId, inventoryItemId);

  if (!current) {
    return null;
  }

  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE inventory_items
      SET
        sku = ?,
        name = ?,
        item_type = ?,
        base_unit = ?,
        minimum_stock = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [
      data.sku !== undefined ? data.sku : current.sku,
      data.name ?? current.name,
      data.itemType ?? current.itemType,
      data.baseUnit ?? current.baseUnit,
      data.minimumStock ?? current.minimumStock,
      businessId,
      inventoryItemId,
    ],
  );

  return findInventoryItemById(businessId, inventoryItemId);
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
