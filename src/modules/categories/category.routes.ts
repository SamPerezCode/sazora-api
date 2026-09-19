import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  createCategoryController,
  listCategoriesController,
  updateCategoryController,
  updateCategoryStatusController,
} from "./controllers/category.controller";

const categoryRouter = Router();

categoryRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  listCategoriesController,
);

categoryRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createCategoryController,
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
