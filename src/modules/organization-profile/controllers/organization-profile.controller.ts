import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { saveOrganizationFiscalProfileSchema } from "../schemas/organization-profile.schema";
import {
  getOrganizationFiscalProfile,
  updateOrganizationFiscalProfile,
} from "../services/organization-profile.service";

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

const getOrganizationFiscalProfileController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const profile = await getOrganizationFiscalProfile(auth.businessId);

  response.status(200).json({
    status: "success",
    data: { profile },
  });
};

const updateOrganizationFiscalProfileController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const input = saveOrganizationFiscalProfileSchema.parse(request.body);

  const profile = await updateOrganizationFiscalProfile(auth.businessId, input);

  response.status(200).json({
    status: "success",
    data: { profile },
  });
};

export {
  getOrganizationFiscalProfileController,
  updateOrganizationFiscalProfileController,
};
