import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { verifyAccessToken } from "../services/token.service";

const createAuthenticationError = (): AppError =>
  new AppError(
    "Se requiere un token de acceso válido",
    401,
    "AUTHENTICATION_REQUIRED",
  );

const authenticate: RequestHandler = (request, _response, next) => {
  const authorizationHeader = request.header("authorization");

  if (!authorizationHeader) {
    throw createAuthenticationError();
  }

  const [scheme, token, ...remainingParts] = authorizationHeader
    .trim()
    .split(/\s+/);

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token ||
    remainingParts.length > 0
  ) {
    throw createAuthenticationError();
  }

  try {
    request.auth = verifyAccessToken(token);
  } catch {
    throw createAuthenticationError();
  }

  next();
};

export { authenticate };
