import { AppError } from "../../../shared/errors/app-error";

import type { AuthenticatedSession } from "../auth.types";

const resolveScopedLocationId = (
  auth: AuthenticatedSession,
  requestedLocationId?: string,
): string | undefined => {
  if (auth.locationAccess.hasGlobalAccess) {
    return requestedLocationId;
  }

  const locationId =
    requestedLocationId ?? auth.locationAccess.defaultLocationId;

  if (!locationId) {
    throw new AppError(
      "Debes tener una ubicación predeterminada o seleccionar una ubicación",
      409,
      "DEFAULT_LOCATION_REQUIRED",
    );
  }

  const hasAccess = auth.locationAccess.locations.some(
    (location) => location.id === locationId,
  );

  if (!hasAccess) {
    throw new AppError(
      "No tienes acceso a esta ubicación",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }

  return locationId;
};

export { resolveScopedLocationId };
