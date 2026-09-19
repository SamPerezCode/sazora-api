import { Router } from "express";

import { catalogImageUpload } from "../../shared/images/catalog-image-upload.middleware";
import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
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

productRouter.get(
  "/:productId",
  authenticate,
  authorizeRoles("ADMIN"),
  getProductController,
);

productRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createProductController,
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
