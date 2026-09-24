import { Router } from "express";

import { businessLogoUpload } from "../../shared/images/business-logo-upload.middleware";
import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  getBusinessSettingsController,
  removeBusinessLogoController,
  updateBusinessLogoController,
  updateBusinessSettingsController,
} from "./controllers/business-settings.controller";

const businessSettingsRouter = Router();

businessSettingsRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  getBusinessSettingsController,
);

businessSettingsRouter.put(
  "/logo",
  authenticate,
  authorizeRoles("ADMIN"),
  businessLogoUpload,
  updateBusinessLogoController,
);

businessSettingsRouter.delete(
  "/logo",
  authenticate,
  authorizeRoles("ADMIN"),
  removeBusinessLogoController,
);

businessSettingsRouter.patch(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  updateBusinessSettingsController,
);

export { businessSettingsRouter };
