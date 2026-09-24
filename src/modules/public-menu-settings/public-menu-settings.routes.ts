import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  getPublicMenuSettingsCatalogController,
  updatePublicCategoryVisibilityController,
  updatePublicProductSettingsController,
} from "./controllers/public-menu-settings.controller";

const publicMenuSettingsRouter = Router();

publicMenuSettingsRouter.get(
  "/catalog",
  authenticate,
  authorizeRoles("ADMIN"),
  getPublicMenuSettingsCatalogController,
);

publicMenuSettingsRouter.patch(
  "/categories/:categoryId",
  authenticate,
  authorizeRoles("ADMIN"),
  updatePublicCategoryVisibilityController,
);

publicMenuSettingsRouter.patch(
  "/products/:productId",
  authenticate,
  authorizeRoles("ADMIN"),
  updatePublicProductSettingsController,
);

export { publicMenuSettingsRouter };
