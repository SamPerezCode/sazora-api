import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  completeProductionOrderController,
  createProductionOrderController,
  getProductionOrderController,
  listProductionOrdersController,
  startProductionOrderController,
  updateProductionOrderController,
  updateProductionOrderStatusController,
} from "./controllers/production-order.controller";

import {
  createProductionOrderWasteController,
  getProductionOrderWasteController,
  listProductionOrderWasteController,
} from "./controllers/production-order-waste.controller";
import { getProductionOrderPerformanceController } from "./controllers/production-order-performance.controller";

const productionOrderRouter = Router();

productionOrderRouter.get(
  "/",
  authenticate,
  authorizePermissions("production.orders.read"),
  listProductionOrdersController,
);

productionOrderRouter.post(
  "/",
  authenticate,
  authorizePermissions("production.orders.manage"),
  createProductionOrderController,
);

productionOrderRouter.post(
  "/:productionOrderId/start",
  authenticate,
  authorizePermissions("production.orders.execute"),
  startProductionOrderController,
);

productionOrderRouter.post(
  "/:productionOrderId/complete",
  authenticate,
  authorizePermissions("production.orders.execute"),
  completeProductionOrderController,
);

productionOrderRouter.get(
  "/:productionOrderId/waste",
  authenticate,
  authorizePermissions("production.waste.read"),
  listProductionOrderWasteController,
);

productionOrderRouter.post(
  "/:productionOrderId/waste",
  authenticate,
  authorizePermissions("production.waste.create"),
  createProductionOrderWasteController,
);

productionOrderRouter.get(
  "/:productionOrderId/waste/:wasteRecordId",
  authenticate,
  authorizePermissions("production.waste.read"),
  getProductionOrderWasteController,
);

productionOrderRouter.get(
  "/:productionOrderId/performance",
  authenticate,
  authorizePermissions("production.reports.read"),
  getProductionOrderPerformanceController,
);

productionOrderRouter.get(
  "/:productionOrderId",
  authenticate,
  authorizePermissions("production.orders.read"),
  getProductionOrderController,
);

productionOrderRouter.put(
  "/:productionOrderId",
  authenticate,
  authorizePermissions("production.orders.manage"),
  updateProductionOrderController,
);

productionOrderRouter.patch(
  "/:productionOrderId/status",
  authenticate,
  authorizePermissions("production.orders.manage"),
  updateProductionOrderStatusController,
);

export { productionOrderRouter };
