import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";

import {
  getInventoryKardexController,
  getInventoryPurchaseReportController,
  getInventorySummaryController,
  getUnvaluedInventoryController,
  getInventoryReconciliationController,
} from "./controllers/inventory-report.controller";

const inventoryReportRouter = Router();

inventoryReportRouter.get(
  "/summary",
  authenticate,
  authorizeRoles("ADMIN"),
  getInventorySummaryController,
);

inventoryReportRouter.get(
  "/unvalued",
  authenticate,
  authorizeRoles("ADMIN"),
  getUnvaluedInventoryController,
);

inventoryReportRouter.get(
  "/kardex",
  authenticate,
  authorizeRoles("ADMIN"),
  getInventoryKardexController,
);

inventoryReportRouter.get(
  "/purchases",
  authenticate,
  authorizeRoles("ADMIN"),
  getInventoryPurchaseReportController,
);

inventoryReportRouter.get(
  "/reconciliation",
  authenticate,
  authorizeRoles("ADMIN"),
  getInventoryReconciliationController,
);

export { inventoryReportRouter };
