import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createLocationController,
  getLocationController,
  listLocationsController,
  updateLocationController,
  updateLocationStatusController,
} from "./controllers/location.controller";

const locationRouter = Router();

locationRouter.use(authenticate);

locationRouter.get(
  "/",
  authorizePermissions("locations.read"),
  listLocationsController,
);

locationRouter.post(
  "/",
  authorizePermissions("locations.manage"),
  createLocationController,
);

locationRouter.get(
  "/:locationId",
  authorizePermissions("locations.read"),
  getLocationController,
);

locationRouter.patch(
  "/:locationId",
  authorizePermissions("locations.manage"),
  updateLocationController,
);

locationRouter.patch(
  "/:locationId/status",
  authorizePermissions("locations.manage"),
  updateLocationStatusController,
);

export { locationRouter };
