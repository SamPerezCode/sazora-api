import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  PublicBusinessProfile,
  PublicMenu,
  PublicMenuCategory,
  PublicMenuProduct,
} from "../public-menu.types";

type PublicBusinessRow = RowDataPacket & {
  businessId: string;
  name: string;
  slug: string;
  timezone: string;
  currencyCode: string;
  tagline: string | null;
  phone: string | null;
  address: string | null;
  openingHoursText: string | null;
  instagram: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  publicMenuDescription: string | null;
  publicOrderingEnabled: number;
};

type PublicMenuItemRow = RowDataPacket & {
  categoryId: string;
  categoryName: string;
  categoryDescription: string | null;
  categoryImageUrl: string | null;
  categoryDisplayOrder: number;
  productId: string;
  productName: string;
  productDescription: string | null;
  productImageUrl: string | null;
  currentPrice: string;
  productIsPubliclyOrderable: number;
};

interface MutablePublicMenuCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  products: PublicMenuProduct[];
}

const mapPublicBusiness = (row: PublicBusinessRow): PublicBusinessProfile => ({
  name: row.name,
  slug: row.slug,
  timezone: row.timezone,
  currencyCode: row.currencyCode,
  tagline: row.tagline,
  phone: row.phone,
  address: row.address,
  openingHoursText: row.openingHoursText,
  instagram: row.instagram,
  logoUrl: row.logoUrl,
  primaryColor: row.primaryColor,
  accentColor: row.accentColor,
  publicMenuDescription: row.publicMenuDescription,
  publicOrderingEnabled: Boolean(row.publicOrderingEnabled),
});

const findPublicMenuByBusinessSlug = async (
  businessSlug: string,
): Promise<PublicMenu | null> => {
  const [businessRows] = await databasePool.execute<PublicBusinessRow[]>(
    `
      SELECT
        CAST(b.id AS CHAR) AS businessId,
        b.name,
        b.slug,
        b.timezone,
        b.currency_code AS currencyCode,
        bs.tagline,
        bs.phone,
        bs.address,
        bs.opening_hours_text AS openingHoursText,
        bs.instagram,
        bs.logo_url AS logoUrl,
        bs.primary_color AS primaryColor,
        bs.accent_color AS accentColor,
        bs.public_menu_description AS publicMenuDescription,
        bs.public_ordering_enabled AS publicOrderingEnabled
      FROM businesses AS b
      INNER JOIN business_settings AS bs
        ON bs.business_id = b.id
      WHERE
        b.slug = ?
        AND b.is_active = TRUE
        AND bs.public_menu_enabled = TRUE
      LIMIT 1
    `,
    [businessSlug],
  );

  const businessRow = businessRows[0];

  if (!businessRow) {
    return null;
  }

  const [itemRows] = await databasePool.execute<PublicMenuItemRow[]>(
    `
      SELECT
        CAST(c.id AS CHAR) AS categoryId,
        c.name AS categoryName,
        c.description AS categoryDescription,
        c.image_url AS categoryImageUrl,
        c.display_order AS categoryDisplayOrder,
        CAST(p.id AS CHAR) AS productId,
        p.name AS productName,
        p.description AS productDescription,
        p.image_url AS productImageUrl,
        CAST(p.current_price AS CHAR) AS currentPrice,
        p.is_publicly_orderable AS productIsPubliclyOrderable
      FROM categories AS c
      INNER JOIN products AS p
        ON p.business_id = c.business_id
        AND p.category_id = c.id
      INNER JOIN preparation_areas AS pa
        ON pa.business_id = p.business_id
        AND pa.id = p.preparation_area_id
        WHERE
        c.business_id = ?
        AND c.is_active = TRUE
        AND c.is_publicly_visible = TRUE
        AND p.is_active = TRUE
        AND p.is_publicly_visible = TRUE
        AND pa.is_active = TRUE
      ORDER BY
        c.display_order ASC,
        c.name ASC,
        c.id ASC,
        p.name ASC,
        p.id ASC
    `,
    [businessRow.businessId],
  );

  const categoryMap = new Map<string, MutablePublicMenuCategory>();

  for (const row of itemRows) {
    let category = categoryMap.get(row.categoryId);

    if (!category) {
      category = {
        id: row.categoryId,
        name: row.categoryName,
        description: row.categoryDescription,
        imageUrl: row.categoryImageUrl,
        displayOrder: row.categoryDisplayOrder,
        products: [],
      };

      categoryMap.set(row.categoryId, category);
    }

    category.products.push({
      id: row.productId,
      name: row.productName,
      description: row.productDescription,
      imageUrl: row.productImageUrl,
      currentPrice: row.currentPrice,
      isOrderable:
        Boolean(row.productIsPubliclyOrderable) &&
        Boolean(businessRow.publicOrderingEnabled),
    });
  }

  const categories: PublicMenuCategory[] = [...categoryMap.values()];

  return {
    business: mapPublicBusiness(businessRow),
    categories,
  };
};

export { findPublicMenuByBusinessSlug };
