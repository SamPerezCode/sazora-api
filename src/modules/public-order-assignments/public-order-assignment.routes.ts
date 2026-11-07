import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createPublicOrderAssignmentController,
  listPublicOrderAssignmentsController,
  updatePublicOrderAssignmentController,
  updatePublicOrderAssignmentStatusController,
} from "./controllers/public-order-assignment.controller";

const publicOrderAssignmentRouter = Router();

publicOrderAssignmentRouter.get(
  "/",
  authenticate,
  authorizePermissions("public_orders.assign"),
  listPublicOrderAssignmentsController,
);

publicOrderAssignmentRouter.post(
  "/",
  authenticate,
  authorizePermissions("public_orders.assign"),
  createPublicOrderAssignmentController,
);

publicOrderAssignmentRouter.put(
  "/:assignmentId",
  authenticate,
  authorizePermissions("public_orders.assign"),
  updatePublicOrderAssignmentController,
);

publicOrderAssignmentRouter.patch(
  "/:assignmentId/status",
  authenticate,
  authorizePermissions("public_orders.assign"),
  updatePublicOrderAssignmentStatusController,
);

export { publicOrderAssignmentRouter };
