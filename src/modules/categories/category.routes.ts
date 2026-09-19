import { Router } from "express";

import { catalogImageUpload } from "../../shared/images/catalog-image-upload.middleware";
import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
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
  authorizeRoles("ADMIN"),
  listCategoriesController,
);

categoryRouter.get(
  "/:categoryId",
  authenticate,
  authorizeRoles("ADMIN"),
  getCategoryController,
);

categoryRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createCategoryController,
);

categoryRouter.put(
  "/:categoryId/image",
  authenticate,
  authorizeRoles("ADMIN"),
  catalogImageUpload,
  updateCategoryImageController,
);

categoryRouter.delete(
  "/:categoryId/image",
  authenticate,
  authorizeRoles("ADMIN"),
  removeCategoryImageController,
);

categoryRouter.patch(
  "/:categoryId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateCategoryStatusController,
);

categoryRouter.patch(
  "/:categoryId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateCategoryController,
);

export { categoryRouter };
