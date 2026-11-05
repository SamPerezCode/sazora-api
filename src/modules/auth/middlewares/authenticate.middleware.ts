import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { findSessionLocationAccess } from "../repositories/auth-location.repository";
import { findActiveSession } from "../repositories/auth.repository";
import { findPermissionsForRoles } from "../repositories/permission.repository";
import { resolveEffectiveRoles } from "../services/effective-roles.service";
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

  const effectiveRoles = resolveEffectiveRoles(
    tokenPayload.roles,
    activeSession.roles,
  );

  if (!effectiveRoles) {
    throw createAuthenticationError();
  }

  const [locationAccess, permissions] = await Promise.all([
    findSessionLocationAccess(
      tokenPayload.businessId,
      tokenPayload.membershipId,
      effectiveRoles,
    ),

    findPermissionsForRoles(effectiveRoles),
  ]);

  request.auth = {
    ...tokenPayload,
    roles: effectiveRoles,
    permissions,
    locationAccess,
  };

  next();
};

export { authenticate };
