import type { RequestHandler } from "express";

import { environment } from "../../../config/env";
import { AppError } from "../../../shared/errors/app-error";
import { changePasswordSchema } from "../schemas/change-password.schema";
import { loginSchema } from "../schemas/login.schema";
import { resetPasswordSchema } from "../schemas/reset-password.schema";
import { requestPasswordRecoverySchema } from "../schemas/request-password-recovery.schema";
import { changePassword } from "../services/change-password.service";
import { login } from "../services/login.service";
import { requestPasswordRecovery } from "../services/request-password-recovery.service";
import { resetPassword } from "../services/reset-password.service";

const loginController: RequestHandler = async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await login(input);

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const getCurrentSessionController: RequestHandler = (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  response.status(200).json({
    status: "success",
    data: {
      session: request.auth,
    },
  });
};

const changePasswordController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const input = changePasswordSchema.parse(request.body);

  await changePassword(request.auth.userId, input);

  response.status(200).json({
    status: "success",
    data: {
      message: "La contraseña fue actualizada. Debes iniciar sesión nuevamente",
    },
  });
};

const requestPasswordRecoveryController: RequestHandler = async (
  request,
  response,
) => {
  const input = requestPasswordRecoverySchema.parse(request.body);

  const resetToken = await requestPasswordRecovery(input);

  const responseData: {
    message: string;
    developmentResetToken?: string;
  } = {
    message:
      "Si existe una cuenta activa con ese correo, se generó una solicitud de recuperación",
  };

  if (environment.NODE_ENV === "development" && resetToken) {
    responseData.developmentResetToken = resetToken;
  }

  response.status(202).json({
    status: "success",
    data: responseData,
  });
};

const resetPasswordController: RequestHandler = async (request, response) => {
  const input = resetPasswordSchema.parse(request.body);

  await resetPassword(input);

  response.status(200).json({
    status: "success",
    data: {
      message: "La contraseña fue restablecida. Ya puedes iniciar sesión",
    },
  });
};

export {
  changePasswordController,
  getCurrentSessionController,
  loginController,
  requestPasswordRecoveryController,
  resetPasswordController,
};
/*
RequestHandler: tipo de manejador proporcionado por Express.
*/
