import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
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
  authorizePermissions("employees.read"),
  listEmployeesController,
);

employeeRouter.post(
  "/",
  authenticate,
  authorizePermissions("employees.manage"),
  createEmployeeController,
);

employeeRouter.get(
  "/:employeeMembershipId/locations",
  authenticate,
  authorizePermissions("employees.read"),
  getEmployeeLocationsController,
);

employeeRouter.put(
  "/:employeeMembershipId/locations",
  authenticate,
  authorizePermissions("employees.manage"),
  updateEmployeeLocationsController,
);

employeeRouter.patch(
  "/:employeeMembershipId/status",
  authenticate,
  authorizePermissions("employees.manage"),
  updateEmployeeStatusController,
);

employeeRouter.put(
  "/:employeeMembershipId/roles",
  authenticate,
  authorizePermissions("employees.manage"),
  updateEmployeeRolesController,
);

employeeRouter.get(
  "/:employeeMembershipId",
  authenticate,
  authorizePermissions("employees.read"),
  getEmployeeController,
);

employeeRouter.patch(
  "/:employeeMembershipId",
  authenticate,
  authorizePermissions("employees.manage"),
  updateEmployeeController,
);

export { employeeRouter };
