import { Router } from "express";

import { catalogImageUpload } from "../../shared/images/catalog-image-upload.middleware";
import { catalogImageWithFieldsUpload } from "../../shared/images/catalog-image-with-fields-upload.middleware";
import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { configureProductInventoryController } from "../product-inventory-links/controllers/configure-product-inventory.controller";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import { getProductAvailabilityController } from "./controllers/product-availability.controller";

import {
  createComboProductController,
  getComboProductController,
  updateComboProductController,
} from "./controllers/combo-product.controller";
import {
  createProductController,
  getProductController,
  listProductsController,
  removeProductImageController,
  updateProductController,
  updateProductImageController,
  updateProductStatusController,
} from "./controllers/product.controller";

const productRouter = Router();

productRouter.get(
  "/availability",
  authenticate,
  authorizePermissions("catalog.read"),
  getProductAvailabilityController,
);

productRouter.get(
  "/",
  authenticate,
  authorizePermissions("catalog.read"),
  listProductsController,
);

productRouter.post(
  "/",
  authenticate,
  authorizePermissions("catalog.manage"),
  catalogImageWithFieldsUpload,
  createProductController,
);

productRouter.post(
  "/combos",
  authenticate,
  authorizePermissions("catalog.manage"),
  catalogImageWithFieldsUpload,
  createComboProductController,
);

productRouter.get(
  "/combos/:comboProductId",
  authenticate,
  authorizePermissions("catalog.read"),
  getComboProductController,
);

productRouter.patch(
  "/combos/:comboProductId",
  authenticate,
  authorizePermissions("catalog.manage"),
  catalogImageWithFieldsUpload,
  updateComboProductController,
);

productRouter.post(
  "/:productId/inventory-setup",
  authenticate,
  authorizePermissions("catalog.manage", "inventory.links.manage"),
  configureProductInventoryController,
);

productRouter.get(
  "/:productId",
  authenticate,
  authorizePermissions("catalog.read"),
  getProductController,
);

productRouter.put(
  "/:productId/image",
  authenticate,
  authorizePermissions("catalog.manage"),
  catalogImageUpload,
  updateProductImageController,
);

productRouter.delete(
  "/:productId/image",
  authenticate,
  authorizePermissions("catalog.manage"),
  removeProductImageController,
);

productRouter.patch(
  "/:productId/status",
  authenticate,
  authorizePermissions("catalog.manage"),
  updateProductStatusController,
);

productRouter.patch(
  "/:productId",
  authenticate,
  authorizePermissions("catalog.manage"),
  updateProductController,
);

export { productRouter };
