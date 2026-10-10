import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  getOrganizationFiscalProfileController,
  updateOrganizationFiscalProfileController,
} from "./controllers/organization-profile.controller";

const organizationProfileRouter = Router();

organizationProfileRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  getOrganizationFiscalProfileController,
);

organizationProfileRouter.put(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  updateOrganizationFiscalProfileController,
);

export { organizationProfileRouter };
