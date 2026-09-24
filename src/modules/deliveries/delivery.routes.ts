import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  configureDeliveryController,
  deliverDeliveryController,
  getDeliveryController,
  listDeliveriesController,
  pickUpDeliveryController,
  startDeliveryController,
} from "./controllers/delivery.controller";

const deliveryRouter = Router();

deliveryRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER", "DELIVERY_DRIVER"),
  listDeliveriesController,
);

deliveryRouter.post(
  "/public-order-requests/:requestId/configure",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER"),
  configureDeliveryController,
);

deliveryRouter.get(
  "/:deliveryId",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER", "DELIVERY_DRIVER"),
  getDeliveryController,
);

deliveryRouter.post(
  "/:deliveryId/pick-up",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER", "DELIVERY_DRIVER"),
  pickUpDeliveryController,
);

deliveryRouter.post(
  "/:deliveryId/start",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER", "DELIVERY_DRIVER"),
  startDeliveryController,
);

deliveryRouter.post(
  "/:deliveryId/deliver",
  authenticate,
  authorizeRoles("ADMIN", "PUBLIC_ORDER_MANAGER", "DELIVERY_DRIVER"),
  deliverDeliveryController,
);

export { deliveryRouter };
