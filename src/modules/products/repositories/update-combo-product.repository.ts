import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ProductFulfillmentMode } from "../product.types";
import type { UpdateComboProductInput } from "../schemas/update-combo-product.schema";

type LockedComboProductRow = RowDataPacket & {
  categoryId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  isCombo: number;
};

type ComponentProductRow = RowDataPacket & {
  id: string;
  isActive: number;
};

type ComponentInventoryLinkRow = RowDataPacket & {
  componentProductId: string;
  inventoryItemId: string;
  quantityPerProduct: string;
};

type UpdateComboProductResult =
  | Readonly<{
      kind: "UPDATED";
    }>
  | Readonly<{
      kind: "COMBO_NOT_FOUND";
    }>
  | Readonly<{
      kind: "SELF_REFERENCE";
    }>
  | Readonly<{
      kind: "COMPONENTS_NOT_AVAILABLE";
      productIds: readonly string[];
    }>
  | Readonly<{
      kind: "COMPONENT_WITHOUT_INVENTORY";
      productId: string;
    }>;

const decimalToThousandths = (value: string): bigint => {
  const [whole = "0", fraction = ""] = value.split(".");

  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0").slice(0, 3));
};

const thousandthsToDecimal = (value: bigint): string => {
  const whole = value / 1000n;
  const fraction = (value % 1000n).toString().padStart(3, "0");

  return `${whole.toString()}.${fraction}`;
};

const updateComboProductRecord = async (
  businessId: string,
  comboProductId: string,
  input: UpdateComboProductInput,
  imageUrl: string | undefined,
): Promise<UpdateComboProductResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [comboRows] = await connection.execute<LockedComboProductRow[]>(
      `
          SELECT
            CAST(p.category_id AS CHAR)
              AS categoryId,
            CAST(p.preparation_area_id AS CHAR)
              AS preparationAreaId,
            p.fulfillment_mode
              AS fulfillmentMode,
            p.sku,
            p.name,
            p.description,
            p.image_url AS imageUrl,
            CAST(p.current_price AS CHAR)
              AS currentPrice,
            EXISTS (
              SELECT 1
              FROM product_combo_components AS pcc
              WHERE
                pcc.business_id = p.business_id
                AND pcc.combo_product_id = p.id
            ) AS isCombo
          FROM products AS p
          WHERE
            p.business_id = ?
            AND p.id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, comboProductId],
    );

    const currentCombo = comboRows[0];

    if (currentCombo?.isCombo !== 1) {
      await connection.rollback();

      return {
        kind: "COMBO_NOT_FOUND",
      };
    }

    if (input.components) {
      const containsItself = input.components.some(
        (component) => component.productId === comboProductId,
      );

      if (containsItself) {
        await connection.rollback();

        return {
          kind: "SELF_REFERENCE",
        };
      }

      const componentProductIds = input.components
        .map((component) => component.productId)
        .sort((first, second) => {
          const firstId = BigInt(first);
          const secondId = BigInt(second);

          if (firstId < secondId) {
            return -1;
          }

          if (firstId > secondId) {
            return 1;
          }

          return 0;
        });

      const placeholders = componentProductIds.map(() => "?").join(", ");

      const [componentProductRows] = await connection.execute<
        ComponentProductRow[]
      >(
        `
            SELECT
              CAST(id AS CHAR) AS id,
              is_active AS isActive
            FROM products
            WHERE
              business_id = ?
              AND id IN (${placeholders})
            ORDER BY id ASC
            FOR UPDATE
          `,
        [businessId, ...componentProductIds],
      );

      const componentProductById = new Map(
        componentProductRows.map((product) => [product.id, product]),
      );

      const unavailableProductIds = componentProductIds.filter((productId) => {
        const product = componentProductById.get(productId);

        return product?.isActive !== 1;
      });

      if (unavailableProductIds.length > 0) {
        await connection.rollback();

        return {
          kind: "COMPONENTS_NOT_AVAILABLE",
          productIds: unavailableProductIds,
        };
      }

      const [componentLinkRows] = await connection.execute<
        ComponentInventoryLinkRow[]
      >(
        `
            SELECT
              CAST(pil.product_id AS CHAR)
                AS componentProductId,
              CAST(pil.inventory_item_id AS CHAR)
                AS inventoryItemId,
              CAST(
                pil.quantity_per_product AS CHAR
              ) AS quantityPerProduct
            FROM product_inventory_links AS pil
            INNER JOIN inventory_items AS ii
              ON ii.business_id =
                pil.business_id
              AND ii.id =
                pil.inventory_item_id
              AND ii.is_active = TRUE
            WHERE
              pil.business_id = ?
              AND pil.product_id IN (
                ${placeholders}
              )
              AND pil.is_active = TRUE
              AND pil.auto_deduct = TRUE
            ORDER BY
              pil.product_id ASC,
              pil.inventory_item_id ASC
            FOR UPDATE
          `,
        [businessId, ...componentProductIds],
      );

      const linkedComponentIds = new Set(
        componentLinkRows.map((link) => link.componentProductId),
      );

      const componentWithoutInventory = componentProductIds.find(
        (productId) => !linkedComponentIds.has(productId),
      );

      if (componentWithoutInventory) {
        await connection.rollback();

        return {
          kind: "COMPONENT_WITHOUT_INVENTORY",
          productId: componentWithoutInventory,
        };
      }

      const componentQuantityByProductId = new Map(
        input.components.map((component) => [
          component.productId,
          BigInt(component.quantity),
        ]),
      );

      const quantityByInventoryItemId = new Map<string, bigint>();

      for (const link of componentLinkRows) {
        const componentQuantity = componentQuantityByProductId.get(
          link.componentProductId,
        );

        if (componentQuantity === undefined) {
          throw new Error(
            "No fue posible recuperar la cantidad del componente",
          );
        }

        const linkedQuantity = decimalToThousandths(link.quantityPerProduct);

        const totalQuantity = linkedQuantity * componentQuantity;

        const accumulatedQuantity =
          quantityByInventoryItemId.get(link.inventoryItemId) ?? 0n;

        quantityByInventoryItemId.set(
          link.inventoryItemId,
          accumulatedQuantity + totalQuantity,
        );
      }

      /*
       * La composición enviada es la nueva
       * fuente de verdad del combo.
       */
      await connection.execute<ResultSetHeader>(
        `
          DELETE FROM product_inventory_links
          WHERE
            business_id = ?
            AND product_id = ?
        `,
        [businessId, comboProductId],
      );

      await connection.execute<ResultSetHeader>(
        `
          DELETE FROM product_combo_components
          WHERE
            business_id = ?
            AND combo_product_id = ?
        `,
        [businessId, comboProductId],
      );

      for (const component of input.components) {
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO product_combo_components (
              business_id,
              combo_product_id,
              component_product_id,
              quantity
            )
            VALUES (?, ?, ?, ?)
          `,
          [
            businessId,
            comboProductId,
            component.productId,
            `${component.quantity}.000`,
          ],
        );
      }

      for (const [inventoryItemId, quantity] of quantityByInventoryItemId) {
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
            VALUES (
              ?,
              ?,
              ?,
              ?,
              TRUE,
              TRUE
            )
          `,
          [
            businessId,
            comboProductId,
            inventoryItemId,
            thousandthsToDecimal(quantity),
          ],
        );
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE products
        SET
          category_id = ?,
          preparation_area_id = ?,
          fulfillment_mode = ?,
          sku = ?,
          name = ?,
          description = ?,
          image_url = ?,
          current_price = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        input.categoryId ?? currentCombo.categoryId,

        input.preparationAreaId ?? currentCombo.preparationAreaId,

        input.fulfillmentMode ?? currentCombo.fulfillmentMode,

        input.sku !== undefined ? input.sku : currentCombo.sku,

        input.name ?? currentCombo.name,

        input.description !== undefined
          ? input.description
          : currentCombo.description,

        imageUrl ?? currentCombo.imageUrl,
        input.currentPrice ?? currentCombo.currentPrice,

        businessId,
        comboProductId,
      ],
    );

    await connection.commit();

    return {
      kind: "UPDATED",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { updateComboProductRecord };

export type { UpdateComboProductResult };
