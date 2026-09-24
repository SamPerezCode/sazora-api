import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ConfigureProductInventoryInput } from "../schemas/configure-product-inventory.schema";

type ProductSetupRow = RowDataPacket & {
  id: string;
  name: string;
  isActive: number;
};

type ExistingLinkRow = RowDataPacket & {
  id: string;
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

    const [productRows] = await connection.execute<ProductSetupRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            name,
            is_active AS isActive
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

    if (product?.isActive !== 1) {
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

    if (Number(data.openingQuantity) > 0) {
      const [openingMovementResult] = await connection.execute<ResultSetHeader>(
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
              ?,
              ?
            )
          `,
        [
          businessId,
          inventoryItemId,
          `Existencia inicial de ${product.name}`,
          membershipId,
        ],
      );

      const openingMovementId = openingMovementResult.insertId.toString();

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
            ?
          )
        `,
        [
          businessId,
          openingMovementId,
          inventoryItemId,
          data.openingQuantity,
          data.openingQuantity,
          `Existencia inicial de ${product.name}`,
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
