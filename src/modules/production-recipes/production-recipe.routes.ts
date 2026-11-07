import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  createProductionRecipeController,
  getProductionRecipeController,
  listProductionRecipesController,
  updateProductionRecipeController,
  updateProductionRecipeStatusController,
} from "./controllers/production-recipe.controller";

const productionRecipeRouter = Router();

productionRecipeRouter.get(
  "/",
  authenticate,
  authorizePermissions("production.recipes.read"),
  listProductionRecipesController,
);

productionRecipeRouter.post(
  "/",
  authenticate,
  authorizePermissions("production.recipes.manage"),
  createProductionRecipeController,
);

productionRecipeRouter.get(
  "/:productionRecipeId",
  authenticate,
  authorizePermissions("production.recipes.read"),
  getProductionRecipeController,
);

productionRecipeRouter.put(
  "/:productionRecipeId",
  authenticate,
  authorizePermissions("production.recipes.manage"),
  updateProductionRecipeController,
);

productionRecipeRouter.patch(
  "/:productionRecipeId/status",
  authenticate,
  authorizePermissions("production.recipes.manage"),
  updateProductionRecipeStatusController,
);

export { productionRecipeRouter };
