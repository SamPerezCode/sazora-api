import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  listInventoryLocationBalancesController,
  valueInitialInventoryController,
} from "./controllers/inventory-location-balance.controller";

import {
  createPurchasePresentationController,
  listPurchasePresentationsController,
} from "../inventory-movements/controllers/inventory-purchase.controller";

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
  authorizePermissions("inventory.items.read"),
  listInventoryItemsController,
);

inventoryItemRouter.post(
  "/",
  authenticate,
  authorizePermissions("inventory.items.manage"),
  createInventoryItemController,
);

inventoryItemRouter.get(
  "/location-balances",
  authenticate,
  authorizePermissions("inventory.balances.read"),
  listInventoryLocationBalancesController,
);

inventoryItemRouter.put(
  "/:inventoryItemId/locations/:locationId/valuation",
  authenticate,
  authorizePermissions("inventory.valuation.manage"),
  valueInitialInventoryController,
);

inventoryItemRouter.get(
  "/:inventoryItemId/purchase-presentations",
  authenticate,
  authorizePermissions("inventory.purchases.read"),
  listPurchasePresentationsController,
);

inventoryItemRouter.post(
  "/:inventoryItemId/purchase-presentations",
  authenticate,
  authorizePermissions("inventory.purchases.create"),
  createPurchasePresentationController,
);

/*
 * El detalle completo continúa reservado para quienes administran
 * el catálogo. PRODUCTION utiliza el catálogo reducido del listado.
 */
inventoryItemRouter.get(
  "/:inventoryItemId",
  authenticate,
  authorizePermissions("inventory.items.manage"),
  getInventoryItemController,
);

inventoryItemRouter.patch(
  "/:inventoryItemId",
  authenticate,
  authorizePermissions("inventory.items.manage"),
  updateInventoryItemController,
);

inventoryItemRouter.patch(
  "/:inventoryItemId/status",
  authenticate,
  authorizePermissions("inventory.items.manage"),
  updateInventoryItemStatusController,
);

export { inventoryItemRouter };
