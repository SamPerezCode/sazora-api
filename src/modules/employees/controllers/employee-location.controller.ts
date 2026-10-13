import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { employeeMembershipIdParamsSchema } from "../schemas/employee-params.schema";
import { updateEmployeeLocationsSchema } from "../schemas/employee-location.schema";
import {
  getEmployeeLocationAccess,
  updateEmployeeLocationAccess,
} from "../services/employee-location.service";

const requireAuth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const getEmployeeLocationsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { employeeMembershipId } = employeeMembershipIdParamsSchema.parse(
    request.params,
  );

  const locationAccess = await getEmployeeLocationAccess(
    auth.businessId,
    employeeMembershipId,
  );

  response.status(200).json({
    status: "success",
    data: {
      locationAccess,
    },
  });
};

const updateEmployeeLocationsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { employeeMembershipId } = employeeMembershipIdParamsSchema.parse(
    request.params,
  );

  const input = updateEmployeeLocationsSchema.parse(request.body);

  const locationAccess = await updateEmployeeLocationAccess(
    auth.businessId,
    employeeMembershipId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      locationAccess,
    },
  });
};

export { getEmployeeLocationsController, updateEmployeeLocationsController };
