import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { updateBusinessSettingsSchema } from "../schemas/update-business-settings.schema";
import { getBusinessSettings } from "../services/get-business-settings.service";
import { removeBusinessLogoReference } from "../services/remove-business-logo.service";
import { replaceBusinessLogo } from "../services/update-business-logo.service";
import { updateBusinessSettings } from "../services/update-business-settings.service";

const getBusinessSettingsController: RequestHandler = async (
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

  const settings = await getBusinessSettings(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      settings,
    },
  });
};

const updateBusinessSettingsController: RequestHandler = async (
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

  const input = updateBusinessSettingsSchema.parse(request.body);

  const settings = await updateBusinessSettings(request.auth.businessId, input);

  response.status(200).json({
    status: "success",
    data: {
      settings,
    },
  });
};

const updateBusinessLogoController: RequestHandler = async (
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

  if (!request.file) {
    throw new AppError(
      "Debes enviar un logo en el campo image",
      400,
      "LOGO_REQUIRED",
    );
  }

  const settings = await replaceBusinessLogo(
    request.auth.businessId,
    request.file.buffer,
  );

  response.status(200).json({
    status: "success",
    data: {
      settings,
    },
  });
};

const removeBusinessLogoController: RequestHandler = async (
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

  const settings = await removeBusinessLogoReference(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      settings,
    },
  });
};

export {
  getBusinessSettingsController,
  removeBusinessLogoController,
  updateBusinessLogoController,
  updateBusinessSettingsController,
};
