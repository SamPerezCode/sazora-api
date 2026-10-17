import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";

import {
  listInventoryLocationBalancesController,
  valueInitialInventoryController,
} from "./controllers/inventory-location-balance.controller";

import {
  createInventoryItemController,
  getInventoryItemController,
  listInventoryItemsController,
  updateInventoryItemController,
  updateInventoryItemStatusController,
} from "./controllers/inventory-item.controller";

const inventoryItemRouter = Router();

inventoryItemRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  listInventoryItemsController,
);

inventoryItemRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createInventoryItemController,
);

inventoryItemRouter.get(
  "/location-balances",
  authenticate,
  authorizeRoles("ADMIN"),
  listInventoryLocationBalancesController,
);

inventoryItemRouter.put(
  "/:inventoryItemId/locations/:locationId/valuation",
  authenticate,
  authorizeRoles("ADMIN"),
  valueInitialInventoryController,
);

inventoryItemRouter.get(
  "/:inventoryItemId",
  authenticate,
  authorizeRoles("ADMIN"),
  getInventoryItemController,
);

inventoryItemRouter.patch(
  "/:inventoryItemId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateInventoryItemController,
);

inventoryItemRouter.patch(
  "/:inventoryItemId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateInventoryItemStatusController,
);

export { inventoryItemRouter };
