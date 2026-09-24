import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  createProductionController,
  getProductionController,
  listProductionController,
} from "./controllers/production.controller";

const productionRouter = Router();

productionRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  listProductionController,
);

productionRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createProductionController,
);

productionRouter.get(
  "/:productionId",
  authenticate,
  authorizeRoles("ADMIN"),
  getProductionController,
);

export { productionRouter };
