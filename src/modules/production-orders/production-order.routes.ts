import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";

import {
  createProductionOrderController,
  getProductionOrderController,
  listProductionOrdersController,
  startProductionOrderController,
  updateProductionOrderController,
  updateProductionOrderStatusController,
} from "./controllers/production-order.controller";

const productionOrderRouter = Router();

productionOrderRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  listProductionOrdersController,
);

productionOrderRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createProductionOrderController,
);

productionOrderRouter.post(
  "/:productionOrderId/start",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  startProductionOrderController,
);

productionOrderRouter.get(
  "/:productionOrderId",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  getProductionOrderController,
);

productionOrderRouter.put(
  "/:productionOrderId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateProductionOrderController,
);

productionOrderRouter.patch(
  "/:productionOrderId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateProductionOrderStatusController,
);

export { productionOrderRouter };
