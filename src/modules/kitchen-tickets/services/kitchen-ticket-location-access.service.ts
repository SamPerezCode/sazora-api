import type { AuthenticatedSession } from "../../auth/auth.types";
import { findLocationById } from "../../locations/repositories/location.repository";
import { AppError } from "../../../shared/errors/app-error";
import { findKitchenTicketLocationId } from "../repositories/kitchen-ticket-location.repository";

const resolveKitchenLocationScope = async (
  auth: AuthenticatedSession,
  requestedLocationId: string | undefined,
): Promise<string> => {
  let locationId: string;

  if (auth.roles.includes("ADMIN")) {
    if (!requestedLocationId) {
      throw new AppError(
        "Debes seleccionar el punto de venta de cocina",
        400,
        "KITCHEN_LOCATION_REQUIRED",
      );
    }

    locationId = requestedLocationId;
  } else {
    locationId =
      requestedLocationId ?? auth.locationAccess.defaultLocationId ?? "";

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
  }

  const location = await findLocationById(auth.businessId, locationId);

  if (!location) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  if (!location.isActive) {
    throw new AppError("La ubicación está inactiva", 409, "LOCATION_INACTIVE");
  }

  if (location.locationType !== "POINT_OF_SALE") {
    throw new AppError(
      "La pantalla de cocina solamente aplica a puntos de venta",
      409,
      "LOCATION_NOT_POINT_OF_SALE",
    );
  }

  return locationId;
};

const assertKitchenTicketLocationAccess = async (
  auth: AuthenticatedSession,
  kitchenTicketId: string,
): Promise<string> => {
  const locationId = await findKitchenTicketLocationId(
    auth.businessId,
    kitchenTicketId,
  );

  if (!locationId) {
    throw new AppError(
      "La comanda no existe en este negocio",
      404,
      "KITCHEN_TICKET_NOT_FOUND",
    );
  }

  if (auth.roles.includes("ADMIN")) {
    return locationId;
  }

  const hasLocationAccess = auth.locationAccess.locations.some(
    (location) => location.id === locationId,
  );

  if (!hasLocationAccess) {
    throw new AppError(
      "No tienes acceso a la ubicación de esta comanda",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }

  return locationId;
};

export { assertKitchenTicketLocationAccess, resolveKitchenLocationScope };
