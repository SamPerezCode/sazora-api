import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreateProductInventoryLinkData,
  ProductInventoryLink,
  UpdateProductInventoryLinkData,
} from "../product-inventory-link.types";

type ProductInventoryLinkRow = RowDataPacket & {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemType: string;
  baseUnit: string;
  quantityPerProduct: string;
  autoDeduct: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

const productInventoryLinkSelect = `
  SELECT
    CAST(pil.id AS CHAR) AS id,
    CAST(pil.business_id AS CHAR) AS businessId,
    CAST(pil.product_id AS CHAR) AS productId,
    p.name AS productName,
    CAST(pil.inventory_item_id AS CHAR)
      AS inventoryItemId,
    ii.name AS inventoryItemName,
    ii.item_type AS inventoryItemType,
    ii.base_unit AS baseUnit,
    CAST(pil.quantity_per_product AS CHAR)
      AS quantityPerProduct,
    pil.auto_deduct AS autoDeduct,
    pil.is_active AS isActive,
    pil.created_at AS createdAt,
    pil.updated_at AS updatedAt
  FROM product_inventory_links AS pil
  INNER JOIN products AS p
    ON p.business_id = pil.business_id
    AND p.id = pil.product_id
  INNER JOIN inventory_items AS ii
    ON ii.business_id = pil.business_id
    AND ii.id = pil.inventory_item_id
`;

const mapProductInventoryLinkRow = (
  row: ProductInventoryLinkRow,
): ProductInventoryLink => ({
  id: row.id,
  businessId: row.businessId,
  productId: row.productId,
  productName: row.productName,
  inventoryItemId: row.inventoryItemId,
  inventoryItemName: row.inventoryItemName,
  inventoryItemType: row.inventoryItemType,
  baseUnit: row.baseUnit,
  quantityPerProduct: row.quantityPerProduct,
  autoDeduct: Boolean(row.autoDeduct),
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findProductInventoryLinkById = async (
  businessId: string,
  linkId: string,
): Promise<ProductInventoryLink | null> => {
  const [rows] = await databasePool.execute<ProductInventoryLinkRow[]>(
    `
        ${productInventoryLinkSelect}
        WHERE
          pil.business_id = ?
          AND pil.id = ?
        LIMIT 1
      `,
    [businessId, linkId],
  );

  return rows[0] ? mapProductInventoryLinkRow(rows[0]) : null;
};

const findProductInventoryLinks = async (
  businessId: string,
): Promise<ProductInventoryLink[]> => {
  const [rows] = await databasePool.execute<ProductInventoryLinkRow[]>(
    `
        ${productInventoryLinkSelect}
        WHERE pil.business_id = ?
        ORDER BY
          p.name ASC,
          ii.name ASC,
          pil.id ASC
      `,
    [businessId],
  );

  return rows.map(mapProductInventoryLinkRow);
};

const insertProductInventoryLink = async (
  businessId: string,
  data: CreateProductInventoryLinkData,
): Promise<ProductInventoryLink> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
        INSERT INTO product_inventory_links (
          business_id,
          product_id,
          inventory_item_id,
          quantity_per_product,
          auto_deduct
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    [
      businessId,
      data.productId,
      data.inventoryItemId,
      data.quantityPerProduct,
      data.autoDeduct,
    ],
  );

  const link = await findProductInventoryLinkById(
    businessId,
    result.insertId.toString(),
  );

  if (!link) {
    throw new Error("No fue posible recuperar la relación creada");
  }

  return link;
};

const updateProductInventoryLinkById = async (
  businessId: string,
  linkId: string,
  data: UpdateProductInventoryLinkData,
): Promise<ProductInventoryLink | null> => {
  const current = await findProductInventoryLinkById(businessId, linkId);

  if (!current) {
    return null;
  }

  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE product_inventory_links
      SET
        quantity_per_product = ?,
        auto_deduct = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [
      data.quantityPerProduct ?? current.quantityPerProduct,
      data.autoDeduct ?? current.autoDeduct,
      businessId,
      linkId,
    ],
  );

  return findProductInventoryLinkById(businessId, linkId);
};

const updateProductInventoryLinkStatusById = async (
  businessId: string,
  linkId: string,
  isActive: boolean,
): Promise<ProductInventoryLink | null> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
          UPDATE product_inventory_links
          SET is_active = ?
          WHERE
            business_id = ?
            AND id = ?
        `,
    [isActive, businessId, linkId],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findProductInventoryLinkById(businessId, linkId);
};

export {
  findProductInventoryLinkById,
  findProductInventoryLinks,
  insertProductInventoryLink,
  updateProductInventoryLinkById,
  updateProductInventoryLinkStatusById,
};
