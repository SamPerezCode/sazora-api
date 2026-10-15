import type { AuthenticatedSession } from "../../auth/auth.types";
import { AppError } from "../../../shared/errors/app-error";
import { findOrderLocationId } from "../repositories/order-location.repository";

const resolveOrderLocationScope = (
  auth: AuthenticatedSession,
  requestedLocationId: string | undefined,
  required: boolean,
): string | undefined => {
  if (auth.roles.includes("ADMIN")) {
    if (required && !requestedLocationId) {
      throw new AppError(
        "Debes seleccionar el punto de venta de la orden",
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
      "Debes tener un punto de venta predeterminado",
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

  if (assignedLocation.locationType !== "POINT_OF_SALE") {
    throw new AppError(
      "Las órdenes de venta solamente pueden gestionarse en puntos de venta",
      409,
      "LOCATION_NOT_POINT_OF_SALE",
    );
  }

  return locationId;
};

const assertOrderLocationAccess = async (
  auth: AuthenticatedSession,
  orderId: string,
): Promise<void> => {
  if (auth.roles.includes("ADMIN")) {
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
