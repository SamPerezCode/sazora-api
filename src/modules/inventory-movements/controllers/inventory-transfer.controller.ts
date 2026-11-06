import type { RequestHandler } from "express";

import { emitInventoryChanged } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import { resolveAssignedInventoryLocation } from "../../inventory-items/services/inventory-location-access.service";

import { createInventoryTransferSchema } from "../schemas/inventory-transfer.schema";
import { createInventoryTransfer } from "../services/inventory-transfer.service";

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

const createInventoryTransferController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const input = createInventoryTransferSchema.parse(request.body);

  let sourceLocationId = input.sourceLocationId;
  let destinationLocationId = input.destinationLocationId;

  if (!auth.locationAccess.hasGlobalAccess) {
    [sourceLocationId, destinationLocationId] = await Promise.all([
      resolveAssignedInventoryLocation(auth, input.sourceLocationId),

      resolveAssignedInventoryLocation(auth, input.destinationLocationId),
    ]);
  }

  const transfer = await createInventoryTransfer(
    auth.businessId,
    auth.membershipId,
    {
      ...input,
      sourceLocationId,
      destinationLocationId,
    },
  );

  emitInventoryChanged(auth.businessId);

  response.status(201).json({
    status: "success",
    data: { transfer },
  });
};

export { createInventoryTransferController };
