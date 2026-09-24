import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
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
  authorizeRoles("ADMIN"),
  listPublicOrderAssignmentsController,
);

publicOrderAssignmentRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createPublicOrderAssignmentController,
);

publicOrderAssignmentRouter.put(
  "/:assignmentId",
  authenticate,
  authorizeRoles("ADMIN"),
  updatePublicOrderAssignmentController,
);

publicOrderAssignmentRouter.patch(
  "/:assignmentId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updatePublicOrderAssignmentStatusController,
);

export { publicOrderAssignmentRouter };
