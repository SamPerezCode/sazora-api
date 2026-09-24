import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { CreateComboProductInput } from "../schemas/create-combo-product.schema";

type ComponentProductRow = RowDataPacket & {
  id: string;
  isActive: number;
};

type ComponentInventoryLinkRow = RowDataPacket & {
  componentProductId: string;
  inventoryItemId: string;
  quantityPerProduct: string;
};

type CreateComboProductResult =
  | Readonly<{
      kind: "CREATED";
      comboProductId: string;
      productInventoryLinkIds: readonly string[];
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

const createComboProductRecord = async (
  businessId: string,
  input: CreateComboProductInput,
  imageUrl: string | null,
): Promise<CreateComboProductResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const componentProductIds = input.components
      .map((component) => component.productId)
      .sort((first, second) => (BigInt(first) < BigInt(second) ? -1 : 1));

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
            CAST(pil.quantity_per_product AS CHAR)
              AS quantityPerProduct
          FROM product_inventory_links AS pil
          INNER JOIN inventory_items AS ii
            ON ii.business_id = pil.business_id
            AND ii.id = pil.inventory_item_id
            AND ii.is_active = TRUE
          WHERE
            pil.business_id = ?
            AND pil.product_id IN (${placeholders})
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
        throw new Error("No fue posible recuperar la cantidad del componente");
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

    const [comboProductResult] = await connection.execute<ResultSetHeader>(
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
        input.categoryId,
        input.preparationAreaId,
        input.fulfillmentMode,
        input.sku,
        input.name,
        input.description,
        imageUrl,
        input.currentPrice,
      ],
    );

    const comboProductId = comboProductResult.insertId.toString();

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

    const productInventoryLinkIds: string[] = [];

    for (const [inventoryItemId, quantity] of quantityByInventoryItemId) {
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
        [
          businessId,
          comboProductId,
          inventoryItemId,
          thousandthsToDecimal(quantity),
        ],
      );

      productInventoryLinkIds.push(linkResult.insertId.toString());
    }

    await connection.commit();

    return {
      kind: "CREATED",
      comboProductId,
      productInventoryLinkIds,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createComboProductRecord };
export type { CreateComboProductResult };
