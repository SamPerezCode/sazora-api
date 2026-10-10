import type { RequestHandler } from "express";

import { emitInventoryChanged } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import {
  createLocationSchema,
  locationIdParamsSchema,
  updateLocationSchema,
  updateLocationStatusSchema,
} from "../schemas/location.schema";
import {
  createLocation,
  getLocation,
  listLocations,
  updateLocation,
  updateLocationStatus,
} from "../services/location.service";

const requireAuth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const listLocationsController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);

  const locations = await listLocations(auth.businessId);

  response.status(200).json({
    status: "success",
    data: { locations },
  });
};

const getLocationController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { locationId } = locationIdParamsSchema.parse(request.params);

  const location = await getLocation(auth.businessId, locationId);

  response.status(200).json({
    status: "success",
    data: { location },
  });
};

const createLocationController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const input = createLocationSchema.parse(request.body);

  const location = await createLocation(auth.businessId, input);

  emitInventoryChanged(auth.businessId);

  response.status(201).json({
    status: "success",
    data: { location },
  });
};

const updateLocationController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { locationId } = locationIdParamsSchema.parse(request.params);
  const input = updateLocationSchema.parse(request.body);

  const location = await updateLocation(auth.businessId, locationId, input);

  emitInventoryChanged(auth.businessId);

  response.status(200).json({
    status: "success",
    data: { location },
  });
};

const updateLocationStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { locationId } = locationIdParamsSchema.parse(request.params);
  const input = updateLocationStatusSchema.parse(request.body);

  const location = await updateLocationStatus(
    auth.businessId,
    locationId,
    input.isActive,
  );

  emitInventoryChanged(auth.businessId);

  response.status(200).json({
    status: "success",
    data: { location },
  });
};

export {
  createLocationController,
  getLocationController,
  listLocationsController,
  updateLocationController,
  updateLocationStatusController,
};
