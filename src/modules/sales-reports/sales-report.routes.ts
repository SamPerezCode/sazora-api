import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  getCancellationReportController,
  getKitchenOperationReportController,
  getPublicMenuConversionReportController,
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

salesReportRouter.get(
  "/public-menu-conversion",
  authenticate,
  authorizePermissions("sales.reports.read"),
  getPublicMenuConversionReportController,
);

export { salesReportRouter };
