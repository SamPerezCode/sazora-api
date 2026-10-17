import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  createInventoryMovementController,
  getInventoryMovementController,
  listInventoryMovementsController,
} from "./controllers/inventory-movement.controller";

import {
  createInventoryPurchaseController,
  getInventoryPurchaseController,
} from "./controllers/inventory-purchase.controller";

const inventoryMovementRouter = Router();

inventoryMovementRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  listInventoryMovementsController,
);

inventoryMovementRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createInventoryMovementController,
);

inventoryMovementRouter.post(
  "/purchases",
  authenticate,
  authorizeRoles("ADMIN"),
  createInventoryPurchaseController,
);

inventoryMovementRouter.get(
  "/purchases/:inventoryMovementId",
  authenticate,
  authorizeRoles("ADMIN"),
  getInventoryPurchaseController,
);

inventoryMovementRouter.get(
  "/:inventoryMovementId",
  authenticate,
  authorizeRoles("ADMIN"),
  getInventoryMovementController,
);

export { inventoryMovementRouter };
