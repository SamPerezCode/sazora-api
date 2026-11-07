import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  getPublicMenuSettingsCatalogController,
  updatePublicCategoryVisibilityController,
  updatePublicProductSettingsController,
} from "./controllers/public-menu-settings.controller";

const publicMenuSettingsRouter = Router();

publicMenuSettingsRouter.get(
  "/catalog",
  authenticate,
  authorizePermissions("public_menu.manage"),
  getPublicMenuSettingsCatalogController,
);

publicMenuSettingsRouter.patch(
  "/categories/:categoryId",
  authenticate,
  authorizePermissions("public_menu.manage"),
  updatePublicCategoryVisibilityController,
);

publicMenuSettingsRouter.patch(
  "/products/:productId",
  authenticate,
  authorizePermissions("public_menu.manage"),
  updatePublicProductSettingsController,
);

export { publicMenuSettingsRouter };
