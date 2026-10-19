import { AppError } from "../../../shared/errors/app-error";

import type { AuthenticatedSession } from "../../auth/auth.types";

import { findInventoryItemById } from "../../inventory-items/repositories/inventory-item.repository";

import type {
  ProductionRecipe,
  ProductionRecipeSummary,
  SaveProductionRecipeData,
} from "../production-recipe.types";

import type {
  CreateProductionRecipeInput,
  UpdateProductionRecipeInput,
} from "../schemas/production-recipe.schema";

import {
  findProductionRecipeById,
  findProductionRecipes,
  insertProductionRecipe,
  updateProductionRecipeById,
  updateProductionRecipeStatusById,
} from "../repositories/production-recipe.repository";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const validateRecipeItems = async (
  businessId: string,
  input: CreateProductionRecipeInput,
): Promise<void> => {
  const inventoryItemIds = [
    ...new Set([
      ...input.inputs.map((line) => line.inventoryItemId),

      ...input.outputs.map((line) => line.inventoryItemId),
    ]),
  ];

  const inventoryItems = await Promise.all(
    inventoryItemIds.map((inventoryItemId) =>
      findInventoryItemById(businessId, inventoryItemId),
    ),
  );

  const unavailableIds = inventoryItemIds.filter(
    (_inventoryItemId, index) => inventoryItems[index]?.isActive !== true,
  );

  if (unavailableIds.length > 0) {
    throw new AppError(
      `Los siguientes artículos no existen o están inactivos: ${unavailableIds.join(", ")}`,
      409,
      "INVENTORY_ITEMS_NOT_AVAILABLE",
    );
  }
};

const normalizeRecipeData = (
  input: CreateProductionRecipeInput,
): SaveProductionRecipeData => ({
  code: input.code,
  name: input.name,
  notes: input.notes,

  inputs: input.inputs.map((line) => ({
    inventoryItemId: line.inventoryItemId,
    quantity: line.quantity,
    notes: line.notes,
  })),

  outputs: input.outputs.map((line) => ({
    inventoryItemId: line.inventoryItemId,
    quantity: line.quantity,

    costAllocationPercentage: line.costAllocationPercentage ?? "100.000000",

    notes: line.notes,
  })),
});

const listProductionRecipes = async (
  auth: AuthenticatedSession,
): Promise<ProductionRecipeSummary[]> => {
  const activeOnly = !auth.roles.includes("ADMIN");

  return findProductionRecipes(auth.businessId, activeOnly);
};

const getProductionRecipe = async (
  auth: AuthenticatedSession,
  productionRecipeId: string,
): Promise<ProductionRecipe> => {
  const recipe = await findProductionRecipeById(
    auth.businessId,
    productionRecipeId,
  );

  if (!recipe || (!recipe.isActive && !auth.roles.includes("ADMIN"))) {
    throw new AppError(
      "La receta de producción no existe",
      404,
      "PRODUCTION_RECIPE_NOT_FOUND",
    );
  }

  return recipe;
};

const createProductionRecipe = async (
  auth: AuthenticatedSession,
  input: CreateProductionRecipeInput,
): Promise<ProductionRecipe> => {
  await validateRecipeItems(auth.businessId, input);

  try {
    return await insertProductionRecipe(
      auth.businessId,
      auth.membershipId,
      normalizeRecipeData(input),
    );
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una receta con ese código o con artículos repetidos",
        409,
        "PRODUCTION_RECIPE_CONFLICT",
      );
    }

    throw error;
  }
};

const updateProductionRecipe = async (
  auth: AuthenticatedSession,
  productionRecipeId: string,
  input: UpdateProductionRecipeInput,
): Promise<ProductionRecipe> => {
  await validateRecipeItems(auth.businessId, input);

  try {
    const recipe = await updateProductionRecipeById(
      auth.businessId,
      auth.membershipId,
      productionRecipeId,
      normalizeRecipeData(input),
    );

    if (!recipe) {
      throw new AppError(
        "La receta de producción no existe",
        404,
        "PRODUCTION_RECIPE_NOT_FOUND",
      );
    }

    return recipe;
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una receta con ese código o con artículos repetidos",
        409,
        "PRODUCTION_RECIPE_CONFLICT",
      );
    }

    throw error;
  }
};

const updateProductionRecipeStatus = async (
  auth: AuthenticatedSession,
  productionRecipeId: string,
  isActive: boolean,
): Promise<ProductionRecipe> => {
  const recipe = await updateProductionRecipeStatusById(
    auth.businessId,
    auth.membershipId,
    productionRecipeId,
    isActive,
  );

  if (!recipe) {
    throw new AppError(
      "La receta de producción no existe",
      404,
      "PRODUCTION_RECIPE_NOT_FOUND",
    );
  }

  return recipe;
};

export {
  createProductionRecipe,
  getProductionRecipe,
  listProductionRecipes,
  updateProductionRecipe,
  updateProductionRecipeStatus,
};
