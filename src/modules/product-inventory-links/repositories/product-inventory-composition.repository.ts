import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import { AppError } from "../../../shared/errors/app-error";
import type { ProductInventoryLink } from "../product-inventory-link.types";
import type { SaveProductInventoryCompositionInput } from "../schemas/product-inventory-composition.schema";

type LockedProductRow = RowDataPacket & {
  isActive: number;
  isCombo: number;
};

type LockedInventoryItemRow = RowDataPacket & {
  isActive: number;
};

type CompositionLinkRow = RowDataPacket & {
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

const saveProductInventoryCompositionRecord = async (
  businessId: string,
  productId: string,
  input: SaveProductInventoryCompositionInput,
): Promise<ProductInventoryLink[]> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [productRows] = await connection.execute<LockedProductRow[]>(
      `
        SELECT
          is_active AS isActive,
          is_combo AS isCombo
        FROM products
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, productId],
    );

    const product = productRows[0];

    if (!product) {
      throw new AppError("El producto no existe", 404, "PRODUCT_NOT_FOUND");
    }

    if (product.isActive !== 1) {
      throw new AppError(
        "El producto está inactivo",
        409,
        "PRODUCT_NOT_AVAILABLE",
      );
    }

    if (product.isCombo === 1) {
      throw new AppError(
        "El combo consume el inventario de sus componentes",
        409,
        "COMBO_INVENTORY_SETUP_NOT_ALLOWED",
      );
    }

    const orderedItems = [...input.items].sort((left, right) => {
      const leftId = BigInt(left.inventoryItemId);
      const rightId = BigInt(right.inventoryItemId);

      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });

    for (const item of orderedItems) {
      const [inventoryRows] = await connection.execute<
        LockedInventoryItemRow[]
      >(
        `
            SELECT is_active AS isActive
            FROM inventory_items
            WHERE
              business_id = ?
              AND id = ?
            LIMIT 1
            FOR SHARE
          `,
        [businessId, item.inventoryItemId],
      );

      const inventoryItem = inventoryRows[0];

      if (inventoryItem?.isActive !== 1) {
        throw new AppError(
          `El artículo de inventario ${item.inventoryItemId} no existe o está inactivo`,
          409,
          "INVENTORY_ITEM_NOT_AVAILABLE",
        );
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE product_inventory_links
        SET is_active = FALSE
        WHERE
          business_id = ?
          AND product_id = ?
          AND is_active = TRUE
      `,
      [businessId, productId],
    );

    for (const item of orderedItems) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO product_inventory_links (
            business_id,
            product_id,
            inventory_item_id,
            quantity_per_product,
            auto_deduct,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, TRUE)
          ON DUPLICATE KEY UPDATE
            quantity_per_product = ?,
            auto_deduct = ?,
            is_active = TRUE
        `,
        [
          businessId,
          productId,
          item.inventoryItemId,
          item.quantityPerProduct,
          item.autoDeduct,
          item.quantityPerProduct,
          item.autoDeduct,
        ],
      );
    }

    const [rows] = await connection.execute<CompositionLinkRow[]>(
      `
        SELECT
          CAST(pil.id AS CHAR) AS id,
          CAST(pil.business_id AS CHAR) AS businessId,
          CAST(pil.product_id AS CHAR) AS productId,
          p.name AS productName,
          CAST(pil.inventory_item_id AS CHAR) AS inventoryItemId,
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
        WHERE
          pil.business_id = ?
          AND pil.product_id = ?
          AND pil.is_active = TRUE
        ORDER BY ii.name ASC, pil.id ASC
      `,
      [businessId, productId],
    );

    const links: ProductInventoryLink[] = rows.map((row) => ({
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
    }));

    await connection.commit();

    return links;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { saveProductInventoryCompositionRecord };
