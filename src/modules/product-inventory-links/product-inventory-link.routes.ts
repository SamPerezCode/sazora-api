import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createProductInventoryLinkController,
  getProductInventoryLinkController,
  listProductInventoryLinksController,
  updateProductInventoryLinkController,
  updateProductInventoryLinkStatusController,
} from "./controllers/product-inventory-link.controller";

const productInventoryLinkRouter = Router();

productInventoryLinkRouter.get(
  "/",
  authenticate,
  authorizePermissions("inventory.links.manage"),
  listProductInventoryLinksController,
);

productInventoryLinkRouter.post(
  "/",
  authenticate,
  authorizePermissions("inventory.links.manage"),
  createProductInventoryLinkController,
);

productInventoryLinkRouter.get(
  "/:productInventoryLinkId",
  authenticate,
  authorizePermissions("inventory.links.manage"),
  getProductInventoryLinkController,
);

productInventoryLinkRouter.patch(
  "/:productInventoryLinkId",
  authenticate,
  authorizePermissions("inventory.links.manage"),
  updateProductInventoryLinkController,
);

productInventoryLinkRouter.patch(
  "/:productInventoryLinkId/status",
  authenticate,
  authorizePermissions("inventory.links.manage"),
  updateProductInventoryLinkStatusController,
);

export { productInventoryLinkRouter };
