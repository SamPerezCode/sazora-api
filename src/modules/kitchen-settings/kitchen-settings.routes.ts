import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  getKitchenSettingsController,
  updateKitchenSettingsController,
} from "./controllers/kitchen-settings.controller";

const kitchenSettingsRouter = Router();

kitchenSettingsRouter.get(
  "/:locationId",
  authenticate,
  authorizeRoles("ADMIN", "WAITER", "KITCHEN"),
  getKitchenSettingsController,
);

kitchenSettingsRouter.patch(
  "/:locationId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateKitchenSettingsController,
);

export { kitchenSettingsRouter };
