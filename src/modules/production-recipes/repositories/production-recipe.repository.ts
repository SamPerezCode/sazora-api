import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type {
  InventoryItemType,
  InventoryUnit,
} from "../../inventory-items/inventory-item.types";

import type {
  ProductionRecipe,
  ProductionRecipeInput,
  ProductionRecipeOutput,
  ProductionRecipeSummary,
  SaveProductionRecipeData,
} from "../production-recipe.types";

type RecipeRow = RowDataPacket & {
  id: string;
  businessId: string;
  code: string;
  name: string;
  notes: string | null;
  isActive: number;

  createdByMembershipId: string;
  createdByName: string;

  updatedByMembershipId: string;
  updatedByName: string;

  createdAt: Date;
  updatedAt: Date;
};

type RecipeSummaryRow = RecipeRow & {
  inputCount: string;
  outputCount: string;
};

type RecipeInputRow = RowDataPacket & {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  inventoryItemType: InventoryItemType;
  baseUnit: InventoryUnit;
  quantity: string;
  notes: string | null;
};

type RecipeOutputRow = RecipeInputRow & {
  costAllocationPercentage: string;
};

const recipeSelect = `
  SELECT
    CAST(pr.id AS CHAR) AS id,
    CAST(pr.business_id AS CHAR) AS businessId,

    pr.code,
    pr.name,
    pr.notes,
    pr.is_active AS isActive,

    CAST(pr.created_by_membership_id AS CHAR)
      AS createdByMembershipId,

    created_user.full_name AS createdByName,

    CAST(pr.updated_by_membership_id AS CHAR)
      AS updatedByMembershipId,

    updated_user.full_name AS updatedByName,

    pr.created_at AS createdAt,
    pr.updated_at AS updatedAt

  FROM production_recipes AS pr

  INNER JOIN business_memberships AS created_membership
    ON created_membership.business_id = pr.business_id
    AND created_membership.id =
      pr.created_by_membership_id

  INNER JOIN users AS created_user
    ON created_user.id = created_membership.user_id

  INNER JOIN business_memberships AS updated_membership
    ON updated_membership.business_id = pr.business_id
    AND updated_membership.id =
      pr.updated_by_membership_id

  INNER JOIN users AS updated_user
    ON updated_user.id = updated_membership.user_id
`;

const mapRecipeHeader = (
  row: RecipeRow,
  inputs: readonly ProductionRecipeInput[],
  outputs: readonly ProductionRecipeOutput[],
): ProductionRecipe => ({
  id: row.id,
  businessId: row.businessId,
  code: row.code,
  name: row.name,
  notes: row.notes,
  isActive: Boolean(row.isActive),

  createdByMembershipId: row.createdByMembershipId,
  createdByName: row.createdByName,

  updatedByMembershipId: row.updatedByMembershipId,
  updatedByName: row.updatedByName,

  createdAt: row.createdAt,
  updatedAt: row.updatedAt,

  inputs,
  outputs,
});

const findProductionRecipeById = async (
  businessId: string,
  productionRecipeId: string,
): Promise<ProductionRecipe | null> => {
  const [recipeRows] = await databasePool.execute<RecipeRow[]>(
    `
      ${recipeSelect}
      WHERE
        pr.business_id = ?
        AND pr.id = ?
      LIMIT 1
    `,
    [businessId, productionRecipeId],
  );

  const recipe = recipeRows[0];

  if (!recipe) {
    return null;
  }

  const [inputRows, outputRows] = await Promise.all([
    databasePool.execute<RecipeInputRow[]>(
      `
        SELECT
          CAST(pri.id AS CHAR) AS id,

          CAST(pri.inventory_item_id AS CHAR)
            AS inventoryItemId,

          ii.name AS inventoryItemName,
          ii.sku AS inventoryItemSku,
          ii.item_type AS inventoryItemType,
          ii.base_unit AS baseUnit,

          CAST(pri.quantity AS CHAR) AS quantity,
          pri.notes

        FROM production_recipe_inputs AS pri

        INNER JOIN inventory_items AS ii
          ON ii.business_id = pri.business_id
          AND ii.id = pri.inventory_item_id

        WHERE
          pri.business_id = ?
          AND pri.recipe_id = ?

        ORDER BY pri.id ASC
      `,
      [businessId, productionRecipeId],
    ),

    databasePool.execute<RecipeOutputRow[]>(
      `
        SELECT
          CAST(pro.id AS CHAR) AS id,

          CAST(pro.inventory_item_id AS CHAR)
            AS inventoryItemId,

          ii.name AS inventoryItemName,
          ii.sku AS inventoryItemSku,
          ii.item_type AS inventoryItemType,
          ii.base_unit AS baseUnit,

          CAST(pro.quantity AS CHAR) AS quantity,

          CAST(pro.cost_allocation_percentage AS CHAR)
            AS costAllocationPercentage,

          pro.notes

        FROM production_recipe_outputs AS pro

        INNER JOIN inventory_items AS ii
          ON ii.business_id = pro.business_id
          AND ii.id = pro.inventory_item_id

        WHERE
          pro.business_id = ?
          AND pro.recipe_id = ?

        ORDER BY pro.id ASC
      `,
      [businessId, productionRecipeId],
    ),
  ]);

  const inputs: ProductionRecipeInput[] = inputRows[0].map((row) => ({
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    inventoryItemName: row.inventoryItemName,
    inventoryItemSku: row.inventoryItemSku,
    inventoryItemType: row.inventoryItemType,
    baseUnit: row.baseUnit,
    quantity: row.quantity,
    notes: row.notes,
  }));

  const outputs: ProductionRecipeOutput[] = outputRows[0].map((row) => ({
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    inventoryItemName: row.inventoryItemName,
    inventoryItemSku: row.inventoryItemSku,
    inventoryItemType: row.inventoryItemType,
    baseUnit: row.baseUnit,
    quantity: row.quantity,
    costAllocationPercentage: row.costAllocationPercentage,
    notes: row.notes,
  }));

  return mapRecipeHeader(recipe, inputs, outputs);
};

const findProductionRecipes = async (
  businessId: string,
  activeOnly: boolean,
): Promise<ProductionRecipeSummary[]> => {
  const activeCondition = activeOnly ? "AND pr.is_active = TRUE" : "";

  const [rows] = await databasePool.execute<RecipeSummaryRow[]>(
    `
        SELECT
          recipe_data.*,

          (
            SELECT COUNT(*)
            FROM production_recipe_inputs AS pri
            WHERE
              pri.business_id = recipe_data.businessId
              AND pri.recipe_id = recipe_data.id
          ) AS inputCount,

          (
            SELECT COUNT(*)
            FROM production_recipe_outputs AS pro
            WHERE
              pro.business_id = recipe_data.businessId
              AND pro.recipe_id = recipe_data.id
          ) AS outputCount

        FROM (
          ${recipeSelect}

          WHERE
            pr.business_id = ?
            ${activeCondition}
        ) AS recipe_data

        ORDER BY
          recipe_data.isActive DESC,
          recipe_data.name ASC,
          recipe_data.id ASC
      `,
    [businessId],
  );

  return rows.map((row) => ({
    id: row.id,
    businessId: row.businessId,
    code: row.code,
    name: row.name,
    notes: row.notes,
    isActive: Boolean(row.isActive),

    createdByMembershipId: row.createdByMembershipId,
    createdByName: row.createdByName,

    updatedByMembershipId: row.updatedByMembershipId,
    updatedByName: row.updatedByName,

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,

    inputCount: Number(row.inputCount),
    outputCount: Number(row.outputCount),
  }));
};

const insertRecipeLines = async (
  connection: PoolConnection,
  businessId: string,
  productionRecipeId: string,
  data: SaveProductionRecipeData,
): Promise<void> => {
  for (const input of data.inputs) {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO production_recipe_inputs (
          business_id,
          recipe_id,
          inventory_item_id,
          quantity,
          notes
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        businessId,
        productionRecipeId,
        input.inventoryItemId,
        input.quantity,
        input.notes,
      ],
    );
  }

  for (const output of data.outputs) {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO production_recipe_outputs (
          business_id,
          recipe_id,
          inventory_item_id,
          quantity,
          cost_allocation_percentage,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        businessId,
        productionRecipeId,
        output.inventoryItemId,
        output.quantity,
        output.costAllocationPercentage,
        output.notes,
      ],
    );
  }
};

const insertProductionRecipe = async (
  businessId: string,
  membershipId: string,
  data: SaveProductionRecipeData,
): Promise<ProductionRecipe> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO production_recipes (
            business_id,
            code,
            name,
            notes,
            created_by_membership_id,
            updated_by_membership_id
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      [
        businessId,
        data.code,
        data.name,
        data.notes,
        membershipId,
        membershipId,
      ],
    );

    const productionRecipeId = result.insertId.toString();

    await insertRecipeLines(connection, businessId, productionRecipeId, data);

    await connection.commit();

    const recipe = await findProductionRecipeById(
      businessId,
      productionRecipeId,
    );

    if (!recipe) {
      throw new Error("No fue posible recuperar la receta creada");
    }

    return recipe;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateProductionRecipeById = async (
  businessId: string,
  membershipId: string,
  productionRecipeId: string,
  data: SaveProductionRecipeData,
): Promise<ProductionRecipe | null> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [recipeRows] = await connection.execute<RowDataPacket[]>(
      `
          SELECT id
          FROM production_recipes
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productionRecipeId],
    );

    if (!recipeRows[0]) {
      await connection.rollback();
      return null;
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE production_recipes
        SET
          code = ?,
          name = ?,
          notes = ?,
          updated_by_membership_id = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        data.code,
        data.name,
        data.notes,
        membershipId,
        businessId,
        productionRecipeId,
      ],
    );

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM production_recipe_outputs
        WHERE
          business_id = ?
          AND recipe_id = ?
      `,
      [businessId, productionRecipeId],
    );

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM production_recipe_inputs
        WHERE
          business_id = ?
          AND recipe_id = ?
      `,
      [businessId, productionRecipeId],
    );

    await insertRecipeLines(connection, businessId, productionRecipeId, data);

    await connection.commit();

    const recipe = await findProductionRecipeById(
      businessId,
      productionRecipeId,
    );

    if (!recipe) {
      throw new Error("No fue posible recuperar la receta actualizada");
    }

    return recipe;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateProductionRecipeStatusById = async (
  businessId: string,
  membershipId: string,
  productionRecipeId: string,
  isActive: boolean,
): Promise<ProductionRecipe | null> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
        UPDATE production_recipes
        SET
          is_active = ?,
          updated_by_membership_id = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
    [isActive, membershipId, businessId, productionRecipeId],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findProductionRecipeById(businessId, productionRecipeId);
};

export {
  findProductionRecipeById,
  findProductionRecipes,
  insertProductionRecipe,
  updateProductionRecipeById,
  updateProductionRecipeStatusById,
};
