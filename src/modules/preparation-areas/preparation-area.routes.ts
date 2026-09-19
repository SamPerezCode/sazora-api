import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  createPreparationAreaController,
  listPreparationAreasController,
  updatePreparationAreaController,
  updatePreparationAreaStatusController,
} from "./controllers/preparation-area.controller";

const preparationAreaRouter = Router();

preparationAreaRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  listPreparationAreasController,
);

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
