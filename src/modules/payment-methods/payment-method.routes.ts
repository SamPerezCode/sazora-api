import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import {
  authorizeAnyPermission,
  authorizePermissions,
} from "../auth/middlewares/authorize-permissions.middleware";
import {
  createPaymentMethodController,
  getPaymentMethodController,
  listPaymentMethodsController,
  updatePaymentMethodController,
  updatePaymentMethodStatusController,
} from "./controllers/payment-method.controller";

const paymentMethodRouter = Router();

paymentMethodRouter.use(authenticate);

paymentMethodRouter.get(
  "/",
  authorizeAnyPermission(
    "cash.sessions.read",
    "business.settings.read",
    "orders.close",
  ),
  listPaymentMethodsController,
);

paymentMethodRouter.post(
  "/",
  authorizePermissions("business.settings.manage"),
  createPaymentMethodController,
);

paymentMethodRouter.get(
  "/:paymentMethodId",
  authorizeAnyPermission(
    "cash.sessions.read",
    "business.settings.read",
    "orders.close",
  ),
  getPaymentMethodController,
);

paymentMethodRouter.patch(
  "/:paymentMethodId/status",
  authorizePermissions("business.settings.manage"),
  updatePaymentMethodStatusController,
);

paymentMethodRouter.patch(
  "/:paymentMethodId",
  authorizePermissions("business.settings.manage"),
  updatePaymentMethodController,
);

export { paymentMethodRouter };
