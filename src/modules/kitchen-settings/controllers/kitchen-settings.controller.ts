import type { RequestHandler } from "express";

import type { AuthenticatedSession } from "../../auth/auth.types";
import { AppError } from "../../../shared/errors/app-error";
import {
  kitchenSettingsParamsSchema,
  updateKitchenSettingsSchema,
} from "../schemas/kitchen-settings.schema";
import {
  getKitchenSettings,
  updateKitchenSettings,
} from "../services/kitchen-settings.service";

const requireAuth = (
  request: Parameters<RequestHandler>[0],
): AuthenticatedSession => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const assertLocationAccess = (
  auth: AuthenticatedSession,
  locationId: string,
): void => {
  if (auth.roles.includes("ADMIN")) {
    return;
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
      "La configuración de comandas solo aplica a puntos de venta",
      409,
      "LOCATION_NOT_POINT_OF_SALE",
    );
  }
};

const getKitchenSettingsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { locationId } = kitchenSettingsParamsSchema.parse(request.params);

  assertLocationAccess(auth, locationId);

  const kitchenSettings = await getKitchenSettings(auth.businessId, locationId);

  response.status(200).json({
    status: "success",
    data: {
      kitchenSettings,
    },
  });
};

const updateKitchenSettingsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { locationId } = kitchenSettingsParamsSchema.parse(request.params);
  const input = updateKitchenSettingsSchema.parse(request.body);

  const kitchenSettings = await updateKitchenSettings(
    auth.businessId,
    locationId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      kitchenSettings,
    },
  });
};

export { getKitchenSettingsController, updateKitchenSettingsController };
