import { Router } from "express";

import { businessLogoUpload } from "../../shared/images/business-logo-upload.middleware";
import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  getBusinessSettingsController,
  initializeBusinessSettingsController,
  removeBusinessLogoController,
  updateBusinessLogoController,
  updateBusinessSettingsController,
} from "./controllers/business-settings.controller";

const businessSettingsRouter = Router();

businessSettingsRouter.get(
  "/",
  authenticate,
  authorizePermissions("business.settings.read"),
  getBusinessSettingsController,
);

businessSettingsRouter.put(
  "/initialize",
  authenticate,
  authorizePermissions("business.settings.manage"),
  initializeBusinessSettingsController,
);

businessSettingsRouter.put(
  "/logo",
  authenticate,
  authorizePermissions("business.settings.manage"),
  businessLogoUpload,
  updateBusinessLogoController,
);

businessSettingsRouter.delete(
  "/logo",
  authenticate,
  authorizePermissions("business.settings.manage"),
  removeBusinessLogoController,
);

businessSettingsRouter.patch(
  "/",
  authenticate,
  authorizePermissions("business.settings.manage"),
  updateBusinessSettingsController,
);

export { businessSettingsRouter };
