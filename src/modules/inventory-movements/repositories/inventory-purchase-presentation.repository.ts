import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type { InventoryUnit } from "../../inventory-items/inventory-item.types";

import type {
  CreateInventoryPurchasePresentationData,
  InventoryPurchasePresentation,
} from "../inventory-purchase.types";

type PresentationRow = RowDataPacket & {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: InventoryUnit;
  name: string;
  conversionFactor: string;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

const presentationSelect = `
  SELECT
    CAST(ipp.id AS CHAR) AS id,

    CAST(ipp.inventory_item_id AS CHAR)
      AS inventoryItemId,

    ii.name AS inventoryItemName,
    ii.base_unit AS baseUnit,

    ipp.name,

    CAST(ipp.conversion_factor AS CHAR)
      AS conversionFactor,

    ipp.is_active AS isActive,
    ipp.created_at AS createdAt,
    ipp.updated_at AS updatedAt

  FROM inventory_purchase_presentations AS ipp

  INNER JOIN inventory_items AS ii
    ON ii.business_id = ipp.business_id
    AND ii.id = ipp.inventory_item_id
`;

const mapPresentation = (
  row: PresentationRow,
): InventoryPurchasePresentation => ({
  id: row.id,
  inventoryItemId: row.inventoryItemId,
  inventoryItemName: row.inventoryItemName,
  baseUnit: row.baseUnit,
  name: row.name,
  conversionFactor: row.conversionFactor,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findPurchasePresentations = async (
  businessId: string,
  inventoryItemId: string,
): Promise<InventoryPurchasePresentation[]> => {
  const [rows] = await databasePool.execute<PresentationRow[]>(
    `
      ${presentationSelect}

      WHERE
        ipp.business_id = ?
        AND ipp.inventory_item_id = ?

      ORDER BY
        ipp.is_active DESC,
        ipp.name ASC,
        ipp.id ASC
    `,
    [businessId, inventoryItemId],
  );

  return rows.map(mapPresentation);
};

const findPurchasePresentationByName = async (
  businessId: string,
  inventoryItemId: string,
  name: string,
): Promise<InventoryPurchasePresentation | null> => {
  const [rows] = await databasePool.execute<PresentationRow[]>(
    `
      ${presentationSelect}

      WHERE
        ipp.business_id = ?
        AND ipp.inventory_item_id = ?
        AND LOWER(ipp.name) = LOWER(?)

      LIMIT 1
    `,
    [businessId, inventoryItemId, name],
  );

  return rows[0] ? mapPresentation(rows[0]) : null;
};

const insertPurchasePresentation = async (
  businessId: string,
  inventoryItemId: string,
  data: CreateInventoryPurchasePresentationData,
): Promise<InventoryPurchasePresentation> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO inventory_purchase_presentations (
        business_id,
        inventory_item_id,
        name,
        conversion_factor
      )
      VALUES (?, ?, ?, ?)
    `,
    [businessId, inventoryItemId, data.name, data.conversionFactor],
  );

  const [rows] = await databasePool.execute<PresentationRow[]>(
    `
      ${presentationSelect}

      WHERE
        ipp.business_id = ?
        AND ipp.id = ?

      LIMIT 1
    `,
    [businessId, result.insertId.toString()],
  );

  const presentation = rows[0];

  if (!presentation) {
    throw new Error(
      "No fue posible recuperar la presentación de compra creada",
    );
  }

  return mapPresentation(presentation);
};

export {
  findPurchasePresentationByName,
  findPurchasePresentations,
  insertPurchasePresentation,
};
