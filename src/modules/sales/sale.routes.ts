import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createSaleController,
  getSaleController,
} from "./controllers/sale.controller";

const saleRouter = Router();

saleRouter.post(
  "/",
  authenticate,
  authorizePermissions("orders.close"),
  createSaleController,
);

saleRouter.get(
  "/:saleId",
  authenticate,
  authorizePermissions("orders.read"),
  getSaleController,
);

export { saleRouter };
