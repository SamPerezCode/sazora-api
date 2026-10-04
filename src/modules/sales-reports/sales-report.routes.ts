import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import { getSalesReportController } from "./controllers/sales-report.controller";

const salesReportRouter = Router();

salesReportRouter.get(
  "/history",
  authenticate,
  authorizeRoles("ADMIN"),
  getSalesReportController,
);

export { salesReportRouter };
