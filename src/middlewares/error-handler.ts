import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";

import { AppError } from "../shared/errors/app-error";

type JsonParseError = SyntaxError & {
  status: number;
  type: string;
};

const isJsonParseError = (error: unknown): error is JsonParseError =>
  error instanceof SyntaxError &&
  "status" in error &&
  error.status === 400 &&
  "type" in error &&
  error.type === "entity.parse.failed";

const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (isJsonParseError(error)) {
    response.status(400).json({
      status: "error",
      code: "INVALID_JSON",
      message: "El cuerpo de la petición no contiene un JSON válido",
    });

    return;
  }

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

  if (error instanceof MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({
        status: "error",
        code: "IMAGE_TOO_LARGE",
        message: "La imagen no puede superar 5 MB",
      });

      return;
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      response.status(400).json({
        status: "error",
        code: "INVALID_IMAGE_FIELD",
        message: "El archivo debe enviarse en el campo image",
      });

      return;
    }

    response.status(400).json({
      status: "error",
      code: "IMAGE_UPLOAD_ERROR",
      message: "No fue posible recibir la imagen",
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
