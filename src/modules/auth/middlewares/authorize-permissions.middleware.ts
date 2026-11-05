import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";

const requireAuthentication = (): AppError =>
  new AppError("Se requiere autenticación", 401, "AUTHENTICATION_REQUIRED");

const createPermissionError = (): AppError =>
  new AppError(
    "No tienes permisos para realizar esta acción",
    403,
    "FORBIDDEN",
  );

const authorizePermissions = (
  ...requiredPermissions: string[]
): RequestHandler => {
  if (requiredPermissions.length === 0) {
    throw new Error("authorizePermissions requiere al menos un permiso");
  }

  const requiredPermissionSet = new Set(requiredPermissions);

  return (request, _response, next) => {
    if (!request.auth) {
      throw requireAuthentication();
    }

    const grantedPermissions = new Set(request.auth.permissions);

    const hasEveryPermission = [...requiredPermissionSet].every((permission) =>
      grantedPermissions.has(permission),
    );

    if (!hasEveryPermission) {
      throw createPermissionError();
    }

    next();
  };
};

const authorizeAnyPermission = (
  ...allowedPermissions: string[]
): RequestHandler => {
  if (allowedPermissions.length === 0) {
    throw new Error("authorizeAnyPermission requiere al menos un permiso");
  }

  const allowedPermissionSet = new Set(allowedPermissions);

  return (request, _response, next) => {
    if (!request.auth) {
      throw requireAuthentication();
    }

    const hasAnyPermission = request.auth.permissions.some((permission) =>
      allowedPermissionSet.has(permission),
    );

    if (!hasAnyPermission) {
      throw createPermissionError();
    }

    next();
  };
};

export { authorizeAnyPermission, authorizePermissions };
