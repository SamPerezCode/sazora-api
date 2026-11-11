import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  closeCashSessionController,
  getCashSessionReconciliationController,
  listCashSessionsController,
  openCashSessionController,
} from "./controllers/cash-session.controller";

const cashSessionRouter = Router();

cashSessionRouter.use(authenticate);

cashSessionRouter.get(
  "/",
  authorizePermissions("cash.sessions.read"),
  listCashSessionsController,
);

cashSessionRouter.post(
  "/open",
  authorizePermissions("cash.sessions.open"),
  openCashSessionController,
);

cashSessionRouter.get(
  "/:cashSessionId/reconciliation",
  authorizePermissions("cash.sessions.read"),
  getCashSessionReconciliationController,
);

cashSessionRouter.post(
  "/:cashSessionId/close",
  authorizePermissions("cash.sessions.close"),
  closeCashSessionController,
);

export { cashSessionRouter };
