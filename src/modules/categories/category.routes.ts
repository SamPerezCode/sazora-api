import { Router } from "express";

import { catalogImageUpload } from "../../shared/images/catalog-image-upload.middleware";
import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createCategoryController,
  getCategoryController,
  listCategoriesController,
  removeCategoryImageController,
  updateCategoryController,
  updateCategoryImageController,
  updateCategoryStatusController,
} from "./controllers/category.controller";

const categoryRouter = Router();

categoryRouter.get(
  "/",
  authenticate,
  authorizePermissions("catalog.read"),
  listCategoriesController,
);

categoryRouter.get(
  "/:categoryId",
  authenticate,
  authorizePermissions("catalog.read"),
  getCategoryController,
);

categoryRouter.post(
  "/",
  authenticate,
  authorizePermissions("catalog.manage"),
  createCategoryController,
);

categoryRouter.put(
  "/:categoryId/image",
  authenticate,
  authorizePermissions("catalog.manage"),
  catalogImageUpload,
  updateCategoryImageController,
);

categoryRouter.delete(
  "/:categoryId/image",
  authenticate,
  authorizePermissions("catalog.manage"),
  removeCategoryImageController,
);

categoryRouter.patch(
  "/:categoryId/status",
  authenticate,
  authorizePermissions("catalog.manage"),
  updateCategoryStatusController,
);

categoryRouter.patch(
  "/:categoryId",
  authenticate,
  authorizePermissions("catalog.manage"),
  updateCategoryController,
);

export { categoryRouter };
