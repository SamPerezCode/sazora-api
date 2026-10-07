import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
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
  authorizeRoles("ADMIN", "KITCHEN"),
  listPreparationAreasController,
);

preparationAreaRouter.get(
  "/:preparationAreaId",
  authenticate,
  authorizeRoles("ADMIN", "KITCHEN"),
  getPreparationAreaController,
);

/**
 * Solamente ADMIN puede crear o modificar áreas.
 */
preparationAreaRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createPreparationAreaController,
);

preparationAreaRouter.patch(
  "/:preparationAreaId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updatePreparationAreaStatusController,
);

preparationAreaRouter.patch(
  "/:preparationAreaId",
  authenticate,
  authorizeRoles("ADMIN"),
  updatePreparationAreaController,
);

export { preparationAreaRouter };
