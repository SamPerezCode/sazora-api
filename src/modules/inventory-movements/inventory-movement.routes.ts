import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createInventoryMovementController,
  getInventoryMovementController,
  listInventoryMovementsController,
} from "./controllers/inventory-movement.controller";
import { createInventoryTransferController } from "./controllers/inventory-transfer.controller";
import {
  createInventoryPurchaseController,
  getInventoryPurchaseController,
} from "./controllers/inventory-purchase.controller";

const inventoryMovementRouter = Router();

inventoryMovementRouter.get(
  "/",
  authenticate,
  authorizePermissions("inventory.movements.read"),
  listInventoryMovementsController,
);

inventoryMovementRouter.post(
  "/",
  authenticate,
  authorizePermissions("inventory.movements.create"),
  createInventoryMovementController,
);

inventoryMovementRouter.post(
  "/purchases",
  authenticate,
  authorizePermissions("inventory.purchases.create"),
  createInventoryPurchaseController,
);

inventoryMovementRouter.get(
  "/purchases/:inventoryMovementId",
  authenticate,
  authorizePermissions("inventory.purchases.read"),
  getInventoryPurchaseController,
);

inventoryMovementRouter.post(
  "/transfers",
  authenticate,
  authorizePermissions("inventory.transfers.create"),
  createInventoryTransferController,
);

inventoryMovementRouter.get(
  "/:inventoryMovementId",
  authenticate,
  authorizePermissions("inventory.movements.read"),
  getInventoryMovementController,
);

export { inventoryMovementRouter };
