import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  createProductionController,
  getProductionController,
  listProductionController,
} from "./controllers/production.controller";

const productionRouter = Router();

productionRouter.get(
  "/",
  authenticate,
  authorizePermissions("production.reports.read"),
  listProductionController,
);

productionRouter.post(
  "/",
  authenticate,
  authorizePermissions("production.quick.create"),
  createProductionController,
);

productionRouter.get(
  "/:productionId",
  authenticate,
  authorizePermissions("production.reports.read"),
  getProductionController,
);

export { productionRouter };
