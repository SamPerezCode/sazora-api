import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";

import {
  getInventoryKardexController,
  getInventoryPurchaseReportController,
  getInventorySummaryController,
  getUnvaluedInventoryController,
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

export { inventoryReportRouter };
