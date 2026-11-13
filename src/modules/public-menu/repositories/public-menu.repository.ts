import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  PublicBusinessProfile,
  PublicMenu,
  PublicMenuCategory,
  PublicMenuLocation,
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

type PublicLocationRow = RowDataPacket & {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
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
  availableLocationIds: string | null;
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

const mapPublicLocation = (row: PublicLocationRow): PublicMenuLocation => ({
  id: row.id,
  code: row.code,
  name: row.name,
  address: row.address,
  phone: row.phone,
});

const parseLocationIds = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  return [...new Set(value.split(",").filter(Boolean))];
};

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

  const [locationRows] = await databasePool.execute<PublicLocationRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        code,
        name,
        address,
        phone
      FROM business_locations
      WHERE
        business_id = ?
        AND location_type = 'POINT_OF_SALE'
        AND is_sales_location = TRUE
        AND is_active = TRUE
      ORDER BY
        name ASC,
        id ASC
    `,
    [businessRow.businessId],
  );

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
        p.is_publicly_orderable AS productIsPubliclyOrderable,
        (
          SELECT GROUP_CONCAT(
            DISTINCT CAST(pal.location_id AS CHAR)
            ORDER BY pal.location_id
            SEPARATOR ','
          )
          FROM preparation_area_locations AS pal
          INNER JOIN business_locations AS available_location
            ON available_location.business_id = pal.business_id
            AND available_location.id = pal.location_id
          WHERE
            pal.business_id = p.business_id
            AND pal.preparation_area_id = p.preparation_area_id
            AND available_location.location_type = 'POINT_OF_SALE'
            AND available_location.is_sales_location = TRUE
            AND available_location.is_active = TRUE
        ) AS availableLocationIds
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

    const availableLocationIds = parseLocationIds(row.availableLocationIds);

    category.products.push({
      id: row.productId,
      name: row.productName,
      description: row.productDescription,
      imageUrl: row.productImageUrl,
      currentPrice: row.currentPrice,
      isOrderable:
        Boolean(row.productIsPubliclyOrderable) &&
        Boolean(businessRow.publicOrderingEnabled) &&
        availableLocationIds.length > 0,
      availableLocationIds,
    });
  }

  const categories: PublicMenuCategory[] = [...categoryMap.values()];

  return {
    business: mapPublicBusiness(businessRow),
    locations: locationRows.map(mapPublicLocation),
    categories,
  };
};

export { findPublicMenuByBusinessSlug };
