import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import { getDashboardController } from "./controllers/dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  getDashboardController,
);

export { dashboardRouter };
