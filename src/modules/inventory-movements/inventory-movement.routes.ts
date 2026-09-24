import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  createInventoryMovementController,
  getInventoryMovementController,
  listInventoryMovementsController,
} from "./controllers/inventory-movement.controller";

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

inventoryMovementRouter.get(
  "/:inventoryMovementId",
  authenticate,
  authorizeRoles("ADMIN"),
  getInventoryMovementController,
);

export { inventoryMovementRouter };
