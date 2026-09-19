import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";

const authorizeRoles = (...allowedRoles: string[]): RequestHandler => {
  if (allowedRoles.length === 0) {
    throw new Error("authorizeRoles requiere al menos un rol");
  }

  const allowedRoleSet = new Set(allowedRoles);

  return (request, _response, next) => {
    if (!request.auth) {
      throw new AppError(
        "Se requiere autenticación",
        401,
        "AUTHENTICATION_REQUIRED",
      );
    }

    const hasAllowedRole = request.auth.roles.some((role) =>
      allowedRoleSet.has(role),
    );

    if (!hasAllowedRole) {
      throw new AppError(
        "No tienes permisos para realizar esta acción",
        403,
        "FORBIDDEN",
      );
    }

    next();
  };
};

export { authorizeRoles };
