import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";

import {
  getOrganizationFiscalProfileController,
  updateOrganizationFiscalProfileController,
} from "./controllers/organization-profile.controller";

const organizationProfileRouter = Router();

organizationProfileRouter.get(
  "/",
  authenticate,
  authorizePermissions("organization.profile.read"),
  getOrganizationFiscalProfileController,
);

organizationProfileRouter.put(
  "/",
  authenticate,
  authorizePermissions("organization.profile.manage"),
  updateOrganizationFiscalProfileController,
);

export { organizationProfileRouter };
