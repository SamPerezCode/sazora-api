import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createSaleController,
  createSaleRefundController,
  getSaleController,
  getSaleRefundController,
  getSaleRefundsController,
  listSalesController,
  voidSaleController,
} from "./controllers/sale.controller";

const saleRouter = Router();

saleRouter.get(
  "/",
  authenticate,
  authorizePermissions("orders.read"),
  listSalesController,
);

saleRouter.post(
  "/",
  authenticate,
  authorizePermissions("orders.close"),
  createSaleController,
);

saleRouter.post(
  "/:saleId/void",
  authenticate,
  authorizePermissions("sales.void"),
  voidSaleController,
);

saleRouter.post(
  "/:saleId/refunds",
  authenticate,
  authorizePermissions("sales.refunds.create"),
  createSaleRefundController,
);

saleRouter.get(
  "/:saleId/refunds",
  authenticate,
  authorizePermissions("sales.refunds.read"),
  getSaleRefundsController,
);

saleRouter.get(
  "/:saleId/refunds/:refundId",
  authenticate,
  authorizePermissions("sales.refunds.read"),
  getSaleRefundController,
);

saleRouter.get(
  "/:saleId",
  authenticate,
  authorizePermissions("orders.read"),
  getSaleController,
);

export { saleRouter };
