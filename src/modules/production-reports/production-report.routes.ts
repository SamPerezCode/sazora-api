import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";

import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  getGroupedProductionReportController,
  getProductionOrderHistoryController,
  getProductionSummaryController,
} from "./controllers/production-report.controller";

const productionReportRouter = Router();

productionReportRouter.get(
  "/orders",
  authenticate,
  authorizePermissions("production.reports.read"),
  getProductionOrderHistoryController,
);

productionReportRouter.get(
  "/summary",
  authenticate,
  authorizePermissions("production.reports.read"),
  getProductionSummaryController,
);

productionReportRouter.get(
  "/groups",
  authenticate,
  authorizePermissions("production.reports.read"),
  getGroupedProductionReportController,
);

export { productionReportRouter };
