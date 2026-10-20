import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";

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

productionOrderRouter.post(
  "/:productionOrderId/complete",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  completeProductionOrderController,
);

productionOrderRouter.get(
  "/:productionOrderId/waste",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  listProductionOrderWasteController,
);

productionOrderRouter.post(
  "/:productionOrderId/waste",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  createProductionOrderWasteController,
);

productionOrderRouter.get(
  "/:productionOrderId/waste/:wasteRecordId",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  getProductionOrderWasteController,
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
