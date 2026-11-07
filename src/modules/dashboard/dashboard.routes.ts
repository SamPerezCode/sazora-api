import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { getDashboardController } from "./controllers/dashboard.controller";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  authenticate,
  authorizePermissions("dashboard.read"),
  getDashboardController,
);

export { dashboardRouter };
