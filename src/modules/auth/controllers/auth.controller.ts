import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { changePasswordSchema } from "../schemas/change-password.schema";
import { changePassword } from "../services/change-password.service";
import { login } from "../services/login.service";
import { loginSchema } from "../schemas/login.schema";

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

export {
  changePasswordController,
  getCurrentSessionController,
  loginController,
};

/*
RequestHandler: tipo de manejador proporcionado por Express.
*/
