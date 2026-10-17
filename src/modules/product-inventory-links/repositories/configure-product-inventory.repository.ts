import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ConfigureProductInventoryInput } from "../schemas/configure-product-inventory.schema";
import { AppError } from "../../../shared/errors/app-error";

import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";

type ProductSetupRow = RowDataPacket & {
  id: string;
  name: string;
  isActive: number;
  isCombo: number;
};

type ExistingLinkRow = RowDataPacket & {
  id: string;
};

type InventoryLocationRow = RowDataPacket & {
  isActive: number;
  isInventoryLocation: number;
};

type ConfigureProductInventoryResult =
  | Readonly<{
      kind: "CONFIGURED";
      inventoryItemId: string;
      productInventoryLinkId: string;
    }>
  | Readonly<{
      kind: "PRODUCT_NOT_AVAILABLE";
    }>
  | Readonly<{
      kind: "ALREADY_CONFIGURED";
      productInventoryLinkId: string;
    }>
  | Readonly<{
      kind: "COMBO_INVENTORY_SETUP_NOT_ALLOWED";
    }>;

const configureProductInventoryRecord = async (
  businessId: string,
  membershipId: string,
  productId: string,
  data: ConfigureProductInventoryInput,
): Promise<ConfigureProductInventoryResult> => {
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

    const [productRows] = await connection.execute<ProductSetupRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            name,
            is_active AS isActive,
            EXISTS (
              SELECT 1
              FROM product_combo_components AS pcc
              WHERE
                pcc.business_id = products.business_id
                AND pcc.combo_product_id = products.id
            ) AS isCombo
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
      await connection.rollback();

      return {
        kind: "PRODUCT_NOT_AVAILABLE",
      };
    }

    if (product.isCombo === 1) {
      await connection.rollback();

      return {
        kind: "COMBO_INVENTORY_SETUP_NOT_ALLOWED",
      };
    }

    if (product.isActive !== 1) {
      await connection.rollback();

      return {
        kind: "PRODUCT_NOT_AVAILABLE",
      };
    }

    const [existingLinkRows] = await connection.execute<ExistingLinkRow[]>(
      `
          SELECT CAST(id AS CHAR) AS id
          FROM product_inventory_links
          WHERE
            business_id = ?
            AND product_id = ?
          ORDER BY id ASC
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productId],
    );

    const existingLink = existingLinkRows[0];

    if (existingLink) {
      await connection.rollback();

      return {
        kind: "ALREADY_CONFIGURED",
        productInventoryLinkId: existingLink.id,
      };
    }

    const inventoryItemType =
      data.trackingType === "RESALE" ? "RESALE_GOOD" : "FINISHED_GOOD";

    const [inventoryItemResult] = await connection.execute<ResultSetHeader>(
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
        product.name,
        inventoryItemType,
        data.baseUnit,
        data.minimumStock,
      ],
    );

    const inventoryItemId = inventoryItemResult.insertId.toString();

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
          externalReference: `PRODUCT:${productId}`,
          notes: `Existencia inicial de ${product.name}`,
          lines: [
            {
              inventoryItemId,
              direction: "IN",
              quantity: data.openingQuantity,
              unitCost: data.openingUnitCost,
              totalCost: null,
              notes: `Existencia inicial de ${product.name}`,
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

    const [linkResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO product_inventory_links (
            business_id,
            product_id,
            inventory_item_id,
            quantity_per_product,
            auto_deduct,
            is_active
          )
          VALUES (?, ?, ?, ?, TRUE, TRUE)
        `,
      [businessId, productId, inventoryItemId, data.quantityPerProduct],
    );

    const productInventoryLinkId = linkResult.insertId.toString();

    await connection.commit();

    return {
      kind: "CONFIGURED",
      inventoryItemId,
      productInventoryLinkId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { configureProductInventoryRecord };

export type { ConfigureProductInventoryResult };
