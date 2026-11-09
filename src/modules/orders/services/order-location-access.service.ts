import type { AuthenticatedSession } from "../../auth/auth.types";
import { AppError } from "../../../shared/errors/app-error";
import { findOrderLocationId } from "../repositories/order-location.repository";

const resolveOrderLocationScope = (
  auth: AuthenticatedSession,
  requestedLocationId: string | undefined,
  required: boolean,
): string | undefined => {
  if (auth.locationAccess.hasGlobalAccess) {
    if (required && !requestedLocationId) {
      throw new AppError(
        "Debes seleccionar la ubicación de la orden",
        400,
        "ORDER_LOCATION_REQUIRED",
      );
    }

    return requestedLocationId;
  }

  const locationId =
    requestedLocationId ?? auth.locationAccess.defaultLocationId;

  if (!locationId) {
    throw new AppError(
      "Debes tener una ubicación predeterminada",
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

  if (!assignedLocation.isSalesLocation) {
    throw new AppError(
      "Esta ubicación no está habilitada para gestionar ventas",
      409,
      "LOCATION_NOT_SALES_ENABLED",
    );
  }

  return locationId;
};

const assertOrderLocationAccess = async (
  auth: AuthenticatedSession,
  orderId: string,
): Promise<void> => {
  if (auth.locationAccess.hasGlobalAccess) {
    return;
  }

  const locationId = await findOrderLocationId(auth.businessId, orderId);

  if (!locationId) {
    throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");
  }

  const hasAccess = auth.locationAccess.locations.some(
    (location) => location.id === locationId,
  );

  if (!hasAccess) {
    throw new AppError(
      "No tienes acceso a la ubicación de esta orden",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }
};

export { assertOrderLocationAccess, resolveOrderLocationScope };
