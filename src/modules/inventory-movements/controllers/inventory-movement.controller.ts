import type { RequestHandler } from "express";

import { emitInventoryChanged } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import { resolveAssignedInventoryLocation } from "../../inventory-items/services/inventory-location-access.service";
import {
  createInventoryMovementSchema,
  inventoryMovementIdParamsSchema,
} from "../schemas/inventory-movement.schema";
import {
  createInventoryMovement,
  getInventoryMovement,
  listInventoryMovements,
} from "../services/inventory-movement.service";

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

const listInventoryMovementsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const locationIds = auth.locationAccess.hasGlobalAccess
    ? undefined
    : auth.locationAccess.locations.map((location) => location.id);

  const movements = await listInventoryMovements(auth.businessId, locationIds);

  response.status(200).json({
    status: "success",
    data: { movements },
  });
};

const getInventoryMovementController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { inventoryMovementId } = inventoryMovementIdParamsSchema.parse(
    request.params,
  );

  const movement = await getInventoryMovement(
    auth.businessId,
    inventoryMovementId,
  );

  if (!auth.locationAccess.hasGlobalAccess) {
    if (!movement.location) {
      throw new AppError(
        "No tienes acceso a este movimiento",
        403,
        "LOCATION_ACCESS_DENIED",
      );
    }

    await resolveAssignedInventoryLocation(auth, movement.location.id);
  }

  response.status(200).json({
    status: "success",
    data: { movement },
  });
};

const createInventoryMovementController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const input = createInventoryMovementSchema.parse(request.body);

  const locationId = auth.locationAccess.hasGlobalAccess
    ? input.locationId
    : await resolveAssignedInventoryLocation(auth, input.locationId);

  const movement = await createInventoryMovement(
    auth.businessId,
    auth.membershipId,
    {
      ...input,
      locationId,
    },
  );

  emitInventoryChanged(auth.businessId);

  response.status(201).json({
    status: "success",
    data: { movement },
  });
};

export {
  createInventoryMovementController,
  getInventoryMovementController,
  listInventoryMovementsController,
};
