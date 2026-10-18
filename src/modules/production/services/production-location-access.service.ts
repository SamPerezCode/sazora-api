import { AppError } from "../../../shared/errors/app-error";

import type { AuthenticatedSession } from "../../auth/auth.types";
import type { InventoryMovement } from "../../inventory-movements/inventory-movement.types";

import { findLocationById } from "../../locations/repositories/location.repository";

const resolveProductionLocation = async (
  auth: AuthenticatedSession,
  requestedLocationId: string,
): Promise<string> => {
  if (!auth.roles.includes("ADMIN")) {
    const hasLocationAccess = auth.locationAccess.locations.some(
      (location) => location.id === requestedLocationId,
    );

    if (!hasLocationAccess) {
      throw new AppError(
        "No tienes acceso a esta ubicación",
        403,
        "LOCATION_ACCESS_DENIED",
      );
    }
  }

  const location = await findLocationById(auth.businessId, requestedLocationId);

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

  if (!location.isProductionLocation) {
    throw new AppError(
      "La ubicación no está habilitada como planta de producción",
      409,
      "LOCATION_NOT_PRODUCTION_ENABLED",
    );
  }

  return location.id;
};

const resolveProductionListScope = async (
  auth: AuthenticatedSession,
  requestedLocationId?: string,
): Promise<readonly string[] | undefined> => {
  if (requestedLocationId) {
    const locationId = await resolveProductionLocation(
      auth,
      requestedLocationId,
    );

    return [locationId];
  }

  if (auth.roles.includes("ADMIN")) {
    return undefined;
  }

  return auth.locationAccess.locations
    .filter((location) => location.locationType === "PRODUCTION_WAREHOUSE")
    .map((location) => location.id);
};

const assertProductionMovementAccess = (
  auth: AuthenticatedSession,
  movement: InventoryMovement,
): void => {
  if (auth.roles.includes("ADMIN")) {
    return;
  }

  const movementLocationId = movement.location?.id;

  if (!movementLocationId) {
    throw new AppError(
      "No tienes acceso a esta producción",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }

  const hasLocationAccess = auth.locationAccess.locations.some(
    (location) =>
      location.id === movementLocationId &&
      location.locationType === "PRODUCTION_WAREHOUSE",
  );

  if (!hasLocationAccess) {
    throw new AppError(
      "No tienes acceso a la planta de esta producción",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }
};

export {
  assertProductionMovementAccess,
  resolveProductionListScope,
  resolveProductionLocation,
};
