import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
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
  authorizeRoles("ADMIN"),
  listProductInventoryLinksController,
);

productInventoryLinkRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createProductInventoryLinkController,
);

productInventoryLinkRouter.get(
  "/:productInventoryLinkId",
  authenticate,
  authorizeRoles("ADMIN"),
  getProductInventoryLinkController,
);

productInventoryLinkRouter.patch(
  "/:productInventoryLinkId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateProductInventoryLinkController,
);

productInventoryLinkRouter.patch(
  "/:productInventoryLinkId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateProductInventoryLinkStatusController,
);

export { productInventoryLinkRouter };
