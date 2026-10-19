import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";

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
  authorizeRoles("ADMIN", "PRODUCTION"),
  listProductionRecipesController,
);

productionRecipeRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createProductionRecipeController,
);

productionRecipeRouter.get(
  "/:productionRecipeId",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  getProductionRecipeController,
);

productionRecipeRouter.put(
  "/:productionRecipeId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateProductionRecipeController,
);

productionRecipeRouter.patch(
  "/:productionRecipeId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateProductionRecipeStatusController,
);

export { productionRecipeRouter };
