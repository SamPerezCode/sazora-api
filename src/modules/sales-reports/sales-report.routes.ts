import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  getCancellationReportController,
  getKitchenOperationReportController,
  getSalesReportController,
} from "./controllers/sales-report.controller";

const salesReportRouter = Router();

salesReportRouter.get(
  "/history",
  authenticate,
  authorizePermissions("sales.reports.read"),
  getSalesReportController,
);

salesReportRouter.get(
  "/cancellations",
  authenticate,
  authorizePermissions("sales.reports.read"),
  getCancellationReportController,
);

salesReportRouter.get(
  "/kitchen-operations",
  authenticate,
  authorizePermissions("sales.reports.read"),
  getKitchenOperationReportController,
);

export { salesReportRouter };
