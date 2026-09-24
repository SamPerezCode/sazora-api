import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
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

  const movements = await listInventoryMovements(auth.businessId);

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

  const movement = await createInventoryMovement(
    auth.businessId,
    auth.membershipId,
    input,
  );

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
