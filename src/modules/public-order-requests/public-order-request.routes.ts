import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
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
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  listPublicOrderRequestsController,
);

publicOrderRequestRouter.get(
  "/:requestId/order",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  getPublicOrderRequestOrderController,
);

publicOrderRequestRouter.post(
  "/:requestId/close-order",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  closePublicOrderRequestOrderController,
);

publicOrderRequestRouter.get(
  "/:requestId",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  getPublicOrderRequestController,
);

publicOrderRequestRouter.post(
  "/:requestId/contact",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  contactPublicOrderRequestController,
);

publicOrderRequestRouter.post(
  "/:requestId/reject",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  rejectPublicOrderRequestController,
);

publicOrderRequestRouter.post(
  "/:requestId/accept",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  acceptPublicOrderRequestController,
);

publicOrderRequestRouter.post(
  "/:requestId/confirm-order",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  confirmPublicOrderRequestOrderController,
);

publicOrderSubmissionRouter.get(
  "/:businessSlug/order-requests/:publicCode",
  getPublicOrderTrackingController,
);

export { publicOrderRequestRouter, publicOrderSubmissionRouter };
