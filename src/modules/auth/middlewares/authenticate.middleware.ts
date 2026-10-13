import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { findSessionLocationAccess } from "../repositories/auth-location.repository";
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

  /*
   * Recupera los roles actuales desde la base de datos.
   * No utiliza los roles del token como fuente definitiva.
   */
  const activeSession = await findActiveSession({
    userId: tokenPayload.userId,
    businessId: tokenPayload.businessId,
    membershipId: tokenPayload.membershipId,
    authVersion: tokenPayload.authVersion,
  });

  if (!activeSession) {
    throw createAuthenticationError();
  }

  /*
   * Recupera las asignaciones actuales en cada petición.
   * Si el administrador cambia las ubicaciones del empleado, no es
   * necesario esperar a que expire su token.
   */
  const locationAccess = await findSessionLocationAccess(
    tokenPayload.businessId,
    tokenPayload.membershipId,
    activeSession.roles,
  );

  request.auth = {
    ...tokenPayload,
    roles: activeSession.roles,
    locationAccess,
  };

  next();
};

export { authenticate };
