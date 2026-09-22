import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { createEmployeeSchema } from "../schemas/create-employee.schema";
import { employeeMembershipIdParamsSchema } from "../schemas/employee-params.schema";
import { updateEmployeeStatusSchema } from "../schemas/update-employee-status.schema";
import { updateEmployeeRolesSchema } from "../schemas/update-employee-roles.schema";
import { updateEmployeeSchema } from "../schemas/update-employee.schema";
import { createEmployee } from "../services/create-employee.service";
import { getEmployee } from "../services/get-employee.service";
import { listEmployees } from "../services/list-employees.service";
import { updateEmployeeStatus } from "../services/update-employee-status.service";
import { updateEmployeeRoles } from "../services/update-employee-roles.service";
import { updateEmployee } from "../services/update-employee.service";

const createEmployeeController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const input = createEmployeeSchema.parse(request.body);

  const employee = await createEmployee(request.auth.businessId, input);

  response.status(201).json({
    status: "success",
    data: {
      employee,
    },
  });
};

const listEmployeesController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const employees = await listEmployees(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      employees,
    },
  });
};

const getEmployeeController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { employeeMembershipId } = employeeMembershipIdParamsSchema.parse(
    request.params,
  );

  const employee = await getEmployee(
    request.auth.businessId,
    employeeMembershipId,
  );

  response.status(200).json({
    status: "success",
    data: {
      employee,
    },
  });
};

const updateEmployeeStatusController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { employeeMembershipId } = employeeMembershipIdParamsSchema.parse(
    request.params,
  );

  const input = updateEmployeeStatusSchema.parse(request.body);

  const employee = await updateEmployeeStatus(
    request.auth.businessId,
    request.auth.membershipId,
    employeeMembershipId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      employee,
    },
  });
};

const updateEmployeeRolesController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { employeeMembershipId } = employeeMembershipIdParamsSchema.parse(
    request.params,
  );

  const input = updateEmployeeRolesSchema.parse(request.body);

  const employee = await updateEmployeeRoles(
    request.auth.businessId,
    request.auth.membershipId,
    employeeMembershipId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      employee,
    },
  });
};

const updateEmployeeController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { employeeMembershipId } = employeeMembershipIdParamsSchema.parse(
    request.params,
  );

  const input = updateEmployeeSchema.parse(request.body);

  const employee = await updateEmployee(
    request.auth.businessId,
    employeeMembershipId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      employee,
    },
  });
};

export {
  createEmployeeController,
  getEmployeeController,
  listEmployeesController,
  updateEmployeeController,
  updateEmployeeRolesController,
  updateEmployeeStatusController,
};
