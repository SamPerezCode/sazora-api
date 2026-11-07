import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  getKitchenSettingsController,
  updateKitchenSettingsController,
} from "./controllers/kitchen-settings.controller";

const kitchenSettingsRouter = Router();

kitchenSettingsRouter.get(
  "/:locationId",
  authenticate,
  authorizePermissions("kitchen.settings.read"),
  getKitchenSettingsController,
);

kitchenSettingsRouter.patch(
  "/:locationId",
  authenticate,
  authorizePermissions("kitchen.settings.manage"),
  updateKitchenSettingsController,
);

export { kitchenSettingsRouter };
