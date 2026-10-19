import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";

import {
  createProductionRecipeSchema,
  productionRecipeIdParamsSchema,
  updateProductionRecipeSchema,
  updateProductionRecipeStatusSchema,
} from "../schemas/production-recipe.schema";

import {
  createProductionRecipe,
  getProductionRecipe,
  listProductionRecipes,
  updateProductionRecipe,
  updateProductionRecipeStatus,
} from "../services/production-recipe.service";

const requireAuth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const listProductionRecipesController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const recipes = await listProductionRecipes(auth);

  response.status(200).json({
    status: "success",
    data: { recipes },
  });
};

const getProductionRecipeController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionRecipeId } = productionRecipeIdParamsSchema.parse(
    request.params,
  );

  const recipe = await getProductionRecipe(auth, productionRecipeId);

  response.status(200).json({
    status: "success",
    data: { recipe },
  });
};

const createProductionRecipeController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const input = createProductionRecipeSchema.parse(request.body);

  const recipe = await createProductionRecipe(auth, input);

  response.status(201).json({
    status: "success",
    data: { recipe },
  });
};

const updateProductionRecipeController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionRecipeId } = productionRecipeIdParamsSchema.parse(
    request.params,
  );

  const input = updateProductionRecipeSchema.parse(request.body);

  const recipe = await updateProductionRecipe(auth, productionRecipeId, input);

  response.status(200).json({
    status: "success",
    data: { recipe },
  });
};

const updateProductionRecipeStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionRecipeId } = productionRecipeIdParamsSchema.parse(
    request.params,
  );

  const { isActive } = updateProductionRecipeStatusSchema.parse(request.body);

  const recipe = await updateProductionRecipeStatus(
    auth,
    productionRecipeId,
    isActive,
  );

  response.status(200).json({
    status: "success",
    data: { recipe },
  });
};

export {
  createProductionRecipeController,
  getProductionRecipeController,
  listProductionRecipesController,
  updateProductionRecipeController,
  updateProductionRecipeStatusController,
};
