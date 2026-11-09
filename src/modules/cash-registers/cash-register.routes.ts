import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createCashRegisterController,
  listCashRegistersController,
} from "./controllers/cash-register.controller";

const cashRegisterRouter = Router();

cashRegisterRouter.use(authenticate);

cashRegisterRouter.get(
  "/",
  authorizePermissions("cash.sessions.read"),
  listCashRegistersController,
);

cashRegisterRouter.post(
  "/",
  authorizePermissions("locations.manage"),
  createCashRegisterController,
);

export { cashRegisterRouter };
