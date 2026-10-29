import { AppError } from "../../../shared/errors/app-error";

import type { AuthenticatedSession } from "../../auth/auth.types";
import { findLocationById } from "../../locations/repositories/location.repository";

const denyProductionLocationAccess = (): never => {
  throw new AppError(
    "No tienes una planta de produccion valida asignada",
    403,
    "PRODUCTION_LOCATION_ACCESS_DENIED",
  );
};

const resolveProductionInventoryLocation = async (
  auth: AuthenticatedSession,
  requestedLocationId?: string,
): Promise<string> => {
  const defaultLocationId = auth.locationAccess.defaultLocationId;

  if (!defaultLocationId) {
    return denyProductionLocationAccess();
  }

  if (
    requestedLocationId !== undefined &&
    requestedLocationId !== defaultLocationId
  ) {
    throw new AppError(
      "No tienes acceso a esta ubicacion",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }

  const assignment = auth.locationAccess.locations.find(
    (location) => location.id === defaultLocationId && location.isDefault,
  );

  if (assignment?.locationType !== "PRODUCTION_WAREHOUSE") {
    return denyProductionLocationAccess();
  }

  const location = await findLocationById(auth.businessId, defaultLocationId);

  if (
    !location ||
    !location.isActive ||
    !location.isInventoryLocation ||
    !location.isProductionLocation ||
    location.locationType !== "PRODUCTION_WAREHOUSE"
  ) {
    return denyProductionLocationAccess();
  }

  return location.id;
};

export { resolveProductionInventoryLocation };
