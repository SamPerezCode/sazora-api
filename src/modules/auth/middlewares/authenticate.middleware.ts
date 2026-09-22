import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { findActiveSession } from "../repositories/auth.repository";
import { verifyAccessToken } from "../services/token.service";

const createAuthenticationError = (): AppError =>
  new AppError(
    "Se requiere un token de acceso válido",
    401,
    "AUTHENTICATION_REQUIRED",
  );

const authenticate: RequestHandler = async (request, _response, next) => {
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

  let tokenPayload;

  try {
    tokenPayload = verifyAccessToken(token);
  } catch {
    throw createAuthenticationError();
  }

  const activeSession = await findActiveSession({
    userId: tokenPayload.userId,
    businessId: tokenPayload.businessId,
    membershipId: tokenPayload.membershipId,
    authVersion: tokenPayload.authVersion,
  });
  if (!activeSession) {
    throw createAuthenticationError();
  }

  request.auth = {
    ...tokenPayload,
    roles: activeSession.roles,
  };

  next();
};

export { authenticate };
