import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreateProductData,
  Product,
  ProductFulfillmentMode,
  ProductInventoryTrackingType,
  ProductListItem,
  UpdateProductData,
} from "../product.types";

type ProductRow = RowDataPacket & {
  id: string;
  businessId: string;
  categoryId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type ProductListRow = ProductRow & {
  categoryName: string;
  categoryIsActive: number;
  preparationAreaName: string;
  preparationAreaIsActive: number;
  isAvailable: number;
  isCombo: number;
  hasInventory: number;
  inventoryTrackingType: ProductInventoryTrackingType;
};

const mapProductRow = (row: ProductRow): Product => ({
  id: row.id,
  businessId: row.businessId,
  categoryId: row.categoryId,
  preparationAreaId: row.preparationAreaId,
  fulfillmentMode: row.fulfillmentMode,
  sku: row.sku,
  name: row.name,
  description: row.description,
  imageUrl: row.imageUrl,
  currentPrice: row.currentPrice,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapProductListRow = (row: ProductListRow): ProductListItem => ({
  ...mapProductRow(row),
  categoryName: row.categoryName,
  categoryIsActive: Boolean(row.categoryIsActive),
  preparationAreaName: row.preparationAreaName,
  preparationAreaIsActive: Boolean(row.preparationAreaIsActive),
  isAvailable: Boolean(row.isAvailable),
  isCombo: Boolean(row.isCombo),
  hasInventory: Boolean(row.hasInventory),
  inventoryTrackingType: row.inventoryTrackingType,
});

const productListSelect = `
  SELECT
    CAST(p.id AS CHAR) AS id,
    CAST(p.business_id AS CHAR)
      AS businessId,
    CAST(p.category_id AS CHAR)
      AS categoryId,
    CAST(p.preparation_area_id AS CHAR)
      AS preparationAreaId,
    p.fulfillment_mode AS fulfillmentMode,
    p.sku,
    p.name,
    p.description,
    p.image_url AS imageUrl,
    CAST(p.current_price AS CHAR)
      AS currentPrice,
    p.is_active AS isActive,
    p.created_at AS createdAt,
    p.updated_at AS updatedAt,
    c.name AS categoryName,
    c.is_active AS categoryIsActive,
    pa.name AS preparationAreaName,
    pa.is_active AS preparationAreaIsActive,

    (
      p.is_active = TRUE
      AND c.is_active = TRUE
      AND pa.is_active = TRUE
    ) AS isAvailable,

    EXISTS (
      SELECT 1
      FROM product_combo_components AS pcc
      WHERE
        pcc.business_id = p.business_id
        AND pcc.combo_product_id = p.id
    ) AS isCombo,

    EXISTS (
      SELECT 1
      FROM product_inventory_links AS pil
      WHERE
        pil.business_id = p.business_id
        AND pil.product_id = p.id
        AND pil.is_active = TRUE
    ) AS hasInventory,

    CASE
      WHEN EXISTS (
        SELECT 1
        FROM product_combo_components AS pcc
        WHERE
          pcc.business_id = p.business_id
          AND pcc.combo_product_id = p.id
      )
        THEN 'COMBO'

      WHEN NOT EXISTS (
        SELECT 1
        FROM product_inventory_links AS pil
        WHERE
          pil.business_id = p.business_id
          AND pil.product_id = p.id
          AND pil.is_active = TRUE
      )
        THEN 'NONE'

      WHEN NOT EXISTS (
        SELECT 1
        FROM product_inventory_links AS pil
        INNER JOIN inventory_items AS ii
          ON ii.business_id = pil.business_id
          AND ii.id = pil.inventory_item_id
        WHERE
          pil.business_id = p.business_id
          AND pil.product_id = p.id
          AND pil.is_active = TRUE
          AND ii.item_type <> 'RESALE_GOOD'
      )
        THEN 'RESALE'

      WHEN NOT EXISTS (
        SELECT 1
        FROM product_inventory_links AS pil
        INNER JOIN inventory_items AS ii
          ON ii.business_id = pil.business_id
          AND ii.id = pil.inventory_item_id
        WHERE
          pil.business_id = p.business_id
          AND pil.product_id = p.id
          AND pil.is_active = TRUE
          AND ii.item_type <> 'FINISHED_GOOD'
      )
        THEN 'PRODUCTION'

      ELSE 'CUSTOM'
    END AS inventoryTrackingType

  FROM products AS p
  INNER JOIN categories AS c
    ON c.business_id = p.business_id
    AND c.id = p.category_id
  INNER JOIN preparation_areas AS pa
    ON pa.business_id = p.business_id
    AND pa.id = p.preparation_area_id
`;

const findProductById = async (
  businessId: string,
  productId: string,
): Promise<Product | null> => {
  const [rows] = await databasePool.execute<ProductRow[]>(
    `
        SELECT
          CAST(id AS CHAR) AS id,
          CAST(business_id AS CHAR)
            AS businessId,
          CAST(category_id AS CHAR)
            AS categoryId,
          CAST(preparation_area_id AS CHAR)
            AS preparationAreaId,
          fulfillment_mode
            AS fulfillmentMode,
          sku,
          name,
          description,
          image_url AS imageUrl,
          CAST(current_price AS CHAR)
            AS currentPrice,
          is_active AS isActive,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM products
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
      `,
    [businessId, productId],
  );

  const product = rows[0];

  return product ? mapProductRow(product) : null;
};

const createProduct = async (
  businessId: string,
  data: CreateProductData,
  imageUrl: string | null = null,
): Promise<Product> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
        INSERT INTO products (
          business_id,
          category_id,
          preparation_area_id,
          fulfillment_mode,
          sku,
          name,
          description,
          image_url,
          current_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    [
      businessId,
      data.categoryId,
      data.preparationAreaId,
      data.fulfillmentMode,
      data.sku,
      data.name,
      data.description,
      imageUrl,
      data.currentPrice,
    ],
  );

  const product = await findProductById(businessId, result.insertId.toString());

  if (!product) {
    throw new Error("No fue posible recuperar el producto creado");
  }

  return product;
};

const findProductsByBusinessId = async (
  businessId: string,
): Promise<ProductListItem[]> => {
  const [rows] = await databasePool.execute<ProductListRow[]>(
    `
        ${productListSelect}
        WHERE p.business_id = ?
        ORDER BY
          p.name ASC,
          p.id ASC
      `,
    [businessId],
  );

  return rows.map(mapProductListRow);
};

const findProductDetailById = async (
  businessId: string,
  productId: string,
): Promise<ProductListItem | null> => {
  const [rows] = await databasePool.execute<ProductListRow[]>(
    `
        ${productListSelect}
        WHERE
          p.business_id = ?
          AND p.id = ?
        LIMIT 1
      `,
    [businessId, productId],
  );

  const product = rows[0];

  return product ? mapProductListRow(product) : null;
};

const updateProduct = async (
  businessId: string,
  productId: string,
  data: UpdateProductData,
): Promise<Product> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE products
      SET
        category_id = ?,
        preparation_area_id = ?,
        fulfillment_mode = ?,
        sku = ?,
        name = ?,
        description = ?,
        current_price = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [
      data.categoryId,
      data.preparationAreaId,
      data.fulfillmentMode,
      data.sku,
      data.name,
      data.description,
      data.currentPrice,
      businessId,
      productId,
    ],
  );

  const product = await findProductById(businessId, productId);

  if (!product) {
    throw new Error("No fue posible recuperar el producto actualizado");
  }

  return product;
};

const updateProductStatus = async (
  businessId: string,
  productId: string,
  isActive: boolean,
): Promise<Product> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE products
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, productId],
  );

  const product = await findProductById(businessId, productId);

  if (!product) {
    throw new Error("No fue posible recuperar el producto actualizado");
  }

  return product;
};

const updateProductImage = async (
  businessId: string,
  productId: string,
  imageUrl: string | null,
): Promise<Product> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE products
      SET image_url = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [imageUrl, businessId, productId],
  );

  const product = await findProductById(businessId, productId);

  if (!product) {
    throw new Error("No fue posible recuperar el producto actualizado");
  }

  return product;
};

export {
  createProduct,
  findProductById,
  findProductDetailById,
  findProductsByBusinessId,
  updateProduct,
  updateProductImage,
  updateProductStatus,
};
