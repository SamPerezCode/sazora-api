import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { loginSchema } from "../schemas/login.schema";
import { login } from "../services/login.service";

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

export { getCurrentSessionController, loginController };

/*
RequestHandler: tipo de manejador proporcionado por Express.
*/
