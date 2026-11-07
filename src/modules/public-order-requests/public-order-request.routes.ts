import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  acceptPublicOrderRequestController,
  closePublicOrderRequestOrderController,
  confirmPublicOrderRequestOrderController,
  contactPublicOrderRequestController,
  createPublicOrderRequestController,
  getPublicOrderRequestController,
  getPublicOrderRequestOrderController,
  listPublicOrderRequestsController,
  rejectPublicOrderRequestController,
  getPublicOrderTrackingController,
} from "./controllers/public-order-request.controller";

const publicOrderSubmissionRouter = Router();
const publicOrderRequestRouter = Router();

publicOrderSubmissionRouter.post(
  "/:businessSlug/order-requests",
  createPublicOrderRequestController,
);

publicOrderRequestRouter.get(
  "/",
  authenticate,
  authorizePermissions("public_orders.read"),
  listPublicOrderRequestsController,
);

publicOrderRequestRouter.get(
  "/:requestId/order",
  authenticate,
  authorizePermissions("public_orders.read"),
  getPublicOrderRequestOrderController,
);

publicOrderRequestRouter.post(
  "/:requestId/close-order",
  authenticate,
  authorizePermissions("public_orders.manage"),
  closePublicOrderRequestOrderController,
);

publicOrderRequestRouter.get(
  "/:requestId",
  authenticate,
  authorizePermissions("public_orders.read"),
  getPublicOrderRequestController,
);

publicOrderRequestRouter.post(
  "/:requestId/contact",
  authenticate,
  authorizePermissions("public_orders.manage"),
  contactPublicOrderRequestController,
);

publicOrderRequestRouter.post(
  "/:requestId/reject",
  authenticate,
  authorizePermissions("public_orders.manage"),
  rejectPublicOrderRequestController,
);

publicOrderRequestRouter.post(
  "/:requestId/accept",
  authenticate,
  authorizePermissions("public_orders.manage"),
  acceptPublicOrderRequestController,
);

publicOrderRequestRouter.post(
  "/:requestId/confirm-order",
  authenticate,
  authorizePermissions("public_orders.manage"),
  confirmPublicOrderRequestOrderController,
);

publicOrderSubmissionRouter.get(
  "/:businessSlug/order-requests/:publicCode",
  getPublicOrderTrackingController,
);

export { publicOrderRequestRouter, publicOrderSubmissionRouter };
