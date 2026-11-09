import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createManualCashMovementController,
  listCashMovementsController,
} from "./controllers/cash-movement.controller";

const cashMovementRouter = Router();

cashMovementRouter.use(authenticate);

cashMovementRouter.get(
  "/",
  authorizePermissions("cash.sessions.read"),
  listCashMovementsController,
);

cashMovementRouter.post(
  "/",
  authorizePermissions("cash.transactions.create"),
  createManualCashMovementController,
);

export { cashMovementRouter };
