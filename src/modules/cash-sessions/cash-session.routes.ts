import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
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

export { cashSessionRouter };
