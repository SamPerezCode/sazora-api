import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  getInventoryKardexController,
  getInventoryPurchaseReportController,
  getInventoryReconciliationController,
  getInventorySummaryController,
  getUnvaluedInventoryController,
} from "./controllers/inventory-report.controller";

const inventoryReportRouter = Router();

inventoryReportRouter.get(
  "/summary",
  authenticate,
  authorizePermissions("inventory.reports.read"),
  getInventorySummaryController,
);

inventoryReportRouter.get(
  "/unvalued",
  authenticate,
  authorizePermissions("inventory.reports.read"),
  getUnvaluedInventoryController,
);

inventoryReportRouter.get(
  "/kardex",
  authenticate,
  authorizePermissions("inventory.reports.read"),
  getInventoryKardexController,
);

inventoryReportRouter.get(
  "/purchases",
  authenticate,
  authorizePermissions("inventory.reports.read"),
  getInventoryPurchaseReportController,
);

inventoryReportRouter.get(
  "/reconciliation",
  authenticate,
  authorizePermissions("inventory.reconciliation.read"),
  getInventoryReconciliationController,
);

export { inventoryReportRouter };
