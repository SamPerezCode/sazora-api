import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  getEmployeeLocationsController,
  updateEmployeeLocationsController,
} from "./controllers/employee-location.controller";
import {
  createEmployeeController,
  getEmployeeController,
  listEmployeesController,
  updateEmployeeController,
  updateEmployeeRolesController,
  updateEmployeeStatusController,
} from "./controllers/employee.controller";

const employeeRouter = Router();

employeeRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  listEmployeesController,
);

employeeRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createEmployeeController,
);

employeeRouter.get(
  "/:employeeMembershipId/locations",
  authenticate,
  authorizeRoles("ADMIN"),
  getEmployeeLocationsController,
);

employeeRouter.put(
  "/:employeeMembershipId/locations",
  authenticate,
  authorizeRoles("ADMIN"),
  updateEmployeeLocationsController,
);

employeeRouter.patch(
  "/:employeeMembershipId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateEmployeeStatusController,
);

employeeRouter.put(
  "/:employeeMembershipId/roles",
  authenticate,
  authorizeRoles("ADMIN"),
  updateEmployeeRolesController,
);

employeeRouter.get(
  "/:employeeMembershipId",
  authenticate,
  authorizeRoles("ADMIN"),
  getEmployeeController,
);

employeeRouter.patch(
  "/:employeeMembershipId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateEmployeeController,
);

export { employeeRouter };
