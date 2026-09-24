import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  PublicMenuSettingsCatalog,
  PublicMenuSettingsCategory,
  PublicMenuSettingsProduct,
} from "../public-menu-settings.types";

type PublicMenuSettingsRow = RowDataPacket & {
  categoryId: string;
  categoryName: string;
  categoryImageUrl: string | null;
  categoryDisplayOrder: number;
  categoryIsActive: number;
  categoryIsPubliclyVisible: number;
  productId: string | null;
  productName: string | null;
  productImageUrl: string | null;
  productCurrentPrice: string | null;
  productIsActive: number | null;
  productIsPubliclyVisible: number | null;
  productIsPubliclyOrderable: number | null;
  preparationAreaIsActive: number | null;
};

interface MutableSettingsCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  isPubliclyVisible: boolean;
  products: PublicMenuSettingsProduct[];
}

const findPublicMenuSettingsCatalog = async (
  businessId: string,
): Promise<PublicMenuSettingsCatalog> => {
  const [rows] = await databasePool.execute<PublicMenuSettingsRow[]>(
    `
      SELECT
        CAST(c.id AS CHAR) AS categoryId,
        c.name AS categoryName,
        c.image_url AS categoryImageUrl,
        c.display_order AS categoryDisplayOrder,
        c.is_active AS categoryIsActive,
        c.is_publicly_visible AS categoryIsPubliclyVisible,
        CAST(p.id AS CHAR) AS productId,
        p.name AS productName,
        p.image_url AS productImageUrl,
        CAST(p.current_price AS CHAR) AS productCurrentPrice,
        p.is_active AS productIsActive,
        p.is_publicly_visible AS productIsPubliclyVisible,
        p.is_publicly_orderable AS productIsPubliclyOrderable,
        pa.is_active AS preparationAreaIsActive
      FROM categories AS c
      LEFT JOIN products AS p
        ON p.business_id = c.business_id
        AND p.category_id = c.id
      LEFT JOIN preparation_areas AS pa
        ON pa.business_id = p.business_id
        AND pa.id = p.preparation_area_id
      WHERE c.business_id = ?
      ORDER BY
        c.display_order ASC,
        c.name ASC,
        c.id ASC,
        p.name ASC,
        p.id ASC
    `,
    [businessId],
  );

  const categoryMap = new Map<string, MutableSettingsCategory>();

  for (const row of rows) {
    let category = categoryMap.get(row.categoryId);

    if (!category) {
      category = {
        id: row.categoryId,
        name: row.categoryName,
        imageUrl: row.categoryImageUrl,
        displayOrder: row.categoryDisplayOrder,
        isActive: Boolean(row.categoryIsActive),
        isPubliclyVisible: Boolean(row.categoryIsPubliclyVisible),
        products: [],
      };

      categoryMap.set(row.categoryId, category);
    }

    if (
      row.productId !== null &&
      row.productName !== null &&
      row.productCurrentPrice !== null
    ) {
      category.products.push({
        id: row.productId,
        name: row.productName,
        imageUrl: row.productImageUrl,
        currentPrice: row.productCurrentPrice,
        isActive: Boolean(row.productIsActive),
        isOperationallyAvailable:
          Boolean(row.productIsActive) &&
          Boolean(row.categoryIsActive) &&
          Boolean(row.preparationAreaIsActive),
        isPubliclyVisible: Boolean(row.productIsPubliclyVisible),
        isPubliclyOrderable: Boolean(row.productIsPubliclyOrderable),
      });
    }
  }

  const categories: PublicMenuSettingsCategory[] = [...categoryMap.values()];

  return {
    categories,
  };
};

const updateCategoryPublicVisibility = async (
  businessId: string,
  categoryId: string,
  isPubliclyVisible: boolean,
): Promise<void> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE categories
      SET is_publicly_visible = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isPubliclyVisible, businessId, categoryId],
  );
};

const updateProductPublicSettings = async (
  businessId: string,
  productId: string,
  isPubliclyVisible: boolean,
  isPubliclyOrderable: boolean,
): Promise<void> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE products
      SET
        is_publicly_visible = ?,
        is_publicly_orderable = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isPubliclyVisible, isPubliclyOrderable, businessId, productId],
  );
};

export {
  findPublicMenuSettingsCatalog,
  updateCategoryPublicVisibility,
  updateProductPublicSettings,
};
