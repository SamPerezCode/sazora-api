import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
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
  authorizePermissions("deliveries.read"),
  listDeliveriesController,
);

deliveryRouter.post(
  "/public-order-requests/:requestId/configure",
  authenticate,
  authorizePermissions("deliveries.manage"),
  configureDeliveryController,
);

deliveryRouter.get(
  "/:deliveryId",
  authenticate,
  authorizePermissions("deliveries.read"),
  getDeliveryController,
);

deliveryRouter.post(
  "/:deliveryId/pick-up",
  authenticate,
  authorizePermissions("deliveries.execute"),
  pickUpDeliveryController,
);

deliveryRouter.post(
  "/:deliveryId/start",
  authenticate,
  authorizePermissions("deliveries.execute"),
  startDeliveryController,
);

deliveryRouter.post(
  "/:deliveryId/deliver",
  authenticate,
  authorizePermissions("deliveries.execute"),
  deliverDeliveryController,
);

export { deliveryRouter };
