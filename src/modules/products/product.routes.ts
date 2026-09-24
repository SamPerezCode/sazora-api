import { Router } from "express";

import { catalogImageUpload } from "../../shared/images/catalog-image-upload.middleware";
import { catalogImageWithFieldsUpload } from "../../shared/images/catalog-image-with-fields-upload.middleware";
import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import { configureProductInventoryController } from "../product-inventory-links/controllers/configure-product-inventory.controller";
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
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  listProductsController,
);

productRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  catalogImageWithFieldsUpload,
  createProductController,
);

productRouter.post(
  "/combos",
  authenticate,
  authorizeRoles("ADMIN"),
  catalogImageWithFieldsUpload,
  createComboProductController,
);

productRouter.get(
  "/combos/:comboProductId",
  authenticate,
  authorizeRoles("ADMIN"),
  getComboProductController,
);

productRouter.patch(
  "/combos/:comboProductId",
  authenticate,
  authorizeRoles("ADMIN"),
  catalogImageWithFieldsUpload,
  updateComboProductController,
);

productRouter.post(
  "/:productId/inventory-setup",
  authenticate,
  authorizeRoles("ADMIN"),
  configureProductInventoryController,
);

productRouter.get(
  "/:productId",
  authenticate,
  authorizeRoles("ADMIN"),
  getProductController,
);

productRouter.put(
  "/:productId/image",
  authenticate,
  authorizeRoles("ADMIN"),
  catalogImageUpload,
  updateProductImageController,
);

productRouter.delete(
  "/:productId/image",
  authenticate,
  authorizeRoles("ADMIN"),
  removeProductImageController,
);

productRouter.patch(
  "/:productId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateProductStatusController,
);

productRouter.patch(
  "/:productId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateProductController,
);

export { productRouter };
