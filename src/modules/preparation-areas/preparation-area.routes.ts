import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  createPreparationAreaController,
  getPreparationAreaController,
  listPreparationAreasController,
  updatePreparationAreaController,
  updatePreparationAreaStatusController,
} from "./controllers/preparation-area.controller";

const preparationAreaRouter = Router();

/**
 * ADMIN:
 * Puede consultar todas las áreas para administrarlas.
 *
 * KITCHEN:
 * Puede consultar las áreas para filtrar sus comandas.
 */
preparationAreaRouter.get(
  "/",
  authenticate,
  authorizePermissions("kitchen.settings.read"),
  listPreparationAreasController,
);

preparationAreaRouter.get(
  "/:preparationAreaId",
  authenticate,
  authorizePermissions("kitchen.settings.read"),
  getPreparationAreaController,
);

preparationAreaRouter.post(
  "/",
  authenticate,
  authorizePermissions("kitchen.settings.manage"),
  createPreparationAreaController,
);

preparationAreaRouter.patch(
  "/:preparationAreaId/status",
  authenticate,
  authorizePermissions("kitchen.settings.manage"),
  updatePreparationAreaStatusController,
);

preparationAreaRouter.patch(
  "/:preparationAreaId",
  authenticate,
  authorizePermissions("kitchen.settings.manage"),
  updatePreparationAreaController,
);

export { preparationAreaRouter };
