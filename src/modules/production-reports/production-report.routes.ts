import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";

import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";

import {
  getGroupedProductionReportController,
  getProductionOrderHistoryController,
  getProductionSummaryController,
} from "./controllers/production-report.controller";

const productionReportRouter = Router();

productionReportRouter.get(
  "/orders",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  getProductionOrderHistoryController,
);

productionReportRouter.get(
  "/summary",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  getProductionSummaryController,
);

productionReportRouter.get(
  "/groups",
  authenticate,
  authorizeRoles("ADMIN", "PRODUCTION"),
  getGroupedProductionReportController,
);

export { productionReportRouter };
