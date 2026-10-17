import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";

import {
  getCancellationReportController,
  getKitchenOperationReportController,
  getSalesReportController,
} from "./controllers/sales-report.controller";

const salesReportRouter = Router();

salesReportRouter.get(
  "/history",
  authenticate,
  authorizeRoles("ADMIN"),
  getSalesReportController,
);

salesReportRouter.get(
  "/cancellations",
  authenticate,
  authorizeRoles("ADMIN"),
  getCancellationReportController,
);

salesReportRouter.get(
  "/kitchen-operations",
  authenticate,
  authorizeRoles("ADMIN"),
  getKitchenOperationReportController,
);

export { salesReportRouter };
