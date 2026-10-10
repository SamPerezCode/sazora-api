import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  createLocationController,
  getLocationController,
  listLocationsController,
  updateLocationController,
  updateLocationStatusController,
} from "./controllers/location.controller";

const locationRouter = Router();

locationRouter.use(authenticate);
locationRouter.use(authorizeRoles("ADMIN"));

locationRouter.get("/", listLocationsController);
locationRouter.post("/", createLocationController);

locationRouter.get("/:locationId", getLocationController);
locationRouter.patch("/:locationId", updateLocationController);

locationRouter.patch("/:locationId/status", updateLocationStatusController);

export { locationRouter };
