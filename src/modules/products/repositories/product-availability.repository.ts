import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  ProductAvailabilityReason,
  ProductCommercialAvailability,
} from "../product.types";

interface LocationStateRow extends RowDataPacket {
  isSalesLocation: number;
  isActive: number;
}

interface ProductAvailabilityRow extends RowDataPacket {
  productId: string;
  locationId: string;
  productName: string;
  currentPrice: string;
  isInventoryTracked: number;
  maxOrderQuantity: string | null;
  isAvailable: number;
  unavailableReason: ProductAvailabilityReason;
}

type FindProductAvailabilityResult =
  | Readonly<{
      kind: "FOUND";
      products: readonly ProductCommercialAvailability[];
    }>
  | Readonly<{
      kind: "LOCATION_NOT_FOUND";
    }>
  | Readonly<{
      kind: "LOCATION_NOT_SALES_ENABLED";
    }>;

const findProductAvailabilityByLocation = async (
  businessId: string,
  locationId: string,
): Promise<FindProductAvailabilityResult> => {
  const [locationRows] = await databasePool.execute<LocationStateRow[]>(
    `
      SELECT
        is_sales_location AS isSalesLocation,
        is_active AS isActive
      FROM business_locations
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, locationId],
  );

  const location = locationRows[0];

  if (!location?.isActive) {
    return {
      kind: "LOCATION_NOT_FOUND",
    };
  }

  if (!location.isSalesLocation) {
    return {
      kind: "LOCATION_NOT_SALES_ENABLED",
    };
  }

  const [rows] = await databasePool.execute<ProductAvailabilityRow[]>(
    `
      WITH active_reservations AS (
        SELECT
          inventory_item_id,
          SUM(quantity) AS reserved_quantity
        FROM inventory_reservations
        WHERE
          business_id = ?
          AND location_id = ?
          AND status = 'ACTIVE'
        GROUP BY inventory_item_id
      ),
      calculated_availability AS (
        SELECT
          CAST(p.id AS CHAR) AS productId,
          ? AS locationId,
          p.name AS productName,
          CAST(p.current_price AS CHAR) AS currentPrice,

          COUNT(pil.id) > 0 AS isInventoryTracked,

          CASE
            WHEN COUNT(pil.id) = 0
              THEN NULL
            ELSE GREATEST(
              FLOOR(
                MIN(
                  CASE
                    WHEN ii.id IS NULL
                      OR ii.is_active = FALSE
                      OR ilb.inventory_item_id IS NULL
                      THEN 0
                    ELSE
                      (
                        ilb.current_stock
                        - COALESCE(ar.reserved_quantity, 0)
                      ) / pil.quantity_per_product
                  END
                )
              ),
              0
            )
          END AS maxOrderQuantity,

          (
            p.is_active = TRUE
            AND c.is_active = TRUE
            AND pa.is_active = TRUE
          ) AS catalogAvailable

        FROM products AS p
        INNER JOIN categories AS c
          ON c.business_id = p.business_id
          AND c.id = p.category_id
        INNER JOIN preparation_areas AS pa
          ON pa.business_id = p.business_id
          AND pa.id = p.preparation_area_id
        LEFT JOIN product_inventory_links AS pil
          ON pil.business_id = p.business_id
          AND pil.product_id = p.id
          AND pil.is_active = TRUE
          AND pil.auto_deduct = TRUE
        LEFT JOIN inventory_items AS ii
          ON ii.business_id = pil.business_id
          AND ii.id = pil.inventory_item_id
        LEFT JOIN inventory_location_balances AS ilb
          ON ilb.business_id = p.business_id
          AND ilb.location_id = ?
          AND ilb.inventory_item_id = pil.inventory_item_id
        LEFT JOIN active_reservations AS ar
          ON ar.inventory_item_id = pil.inventory_item_id
        WHERE p.business_id = ?
        GROUP BY
          p.id,
          p.name,
          p.current_price,
          p.is_active,
          c.is_active,
          pa.is_active
      )
      SELECT
        productId,
        locationId,
        productName,
        currentPrice,
        isInventoryTracked,
        CAST(maxOrderQuantity AS CHAR) AS maxOrderQuantity,
        (
          catalogAvailable = TRUE
          AND (
            isInventoryTracked = FALSE
            OR maxOrderQuantity >= 1
          )
        ) AS isAvailable,
        CASE
          WHEN catalogAvailable = FALSE
            THEN 'PRODUCT_INACTIVE'
          WHEN isInventoryTracked = TRUE
            AND maxOrderQuantity < 1
            THEN 'OUT_OF_STOCK'
          ELSE NULL
        END AS unavailableReason
      FROM calculated_availability
      ORDER BY productName ASC, productId ASC
    `,
    [businessId, locationId, locationId, locationId, businessId],
  );

  return {
    kind: "FOUND",
    products: rows.map((row) => ({
      productId: row.productId,
      locationId: row.locationId,
      productName: row.productName,
      currentPrice: row.currentPrice,
      isInventoryTracked: Boolean(row.isInventoryTracked),
      maxOrderQuantity:
        row.maxOrderQuantity === null ? null : Number(row.maxOrderQuantity),
      isAvailable: Boolean(row.isAvailable),
      unavailableReason: row.unavailableReason,
    })),
  };
};

export { findProductAvailabilityByLocation };
export type { FindProductAvailabilityResult };
