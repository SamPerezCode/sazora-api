import { AppError } from "../../../shared/errors/app-error";

import type { AuthenticatedSession } from "../../auth/auth.types";
import { findLocationById } from "../../locations/repositories/location.repository";

const resolveAssignedInventoryLocation = async (
  auth: AuthenticatedSession,
  requestedLocationId?: string,
): Promise<string> => {
  if (auth.locationAccess.hasGlobalAccess) {
    if (!requestedLocationId) {
      throw new AppError(
        "Debes seleccionar una ubicación",
        400,
        "INVENTORY_LOCATION_REQUIRED",
      );
    }

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

  const assignedLocation = auth.locationAccess.locations.find(
    (location) => location.id === locationId,
  );

  if (!assignedLocation) {
    throw new AppError(
      "No tienes acceso a esta ubicación",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }

  const location = await findLocationById(auth.businessId, locationId);

  if (!location) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  if (!location.isActive) {
    throw new AppError("La ubicación está inactiva", 409, "LOCATION_INACTIVE");
  }

  if (!location.isInventoryLocation) {
    throw new AppError(
      "La ubicación no está habilitada para inventario",
      409,
      "LOCATION_NOT_INVENTORY_ENABLED",
    );
  }

  return location.id;
};

export { resolveAssignedInventoryLocation };
