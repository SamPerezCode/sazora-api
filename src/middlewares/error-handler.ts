import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../shared/errors/app-error";

const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      status: "error",
      code: "VALIDATION_ERROR",
      message: "Los datos enviados no son válidos",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });

    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });

    return;
  }

  console.error(error);

  response.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "Error interno del servidor",
  });
};

export { errorHandler };
