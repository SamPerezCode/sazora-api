import type { RequestHandler } from "express";

import { emitInventoryChanged } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";

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

  const transfer = await createInventoryTransfer(
    auth.businessId,
    auth.membershipId,
    input,
  );

  emitInventoryChanged(auth.businessId);

  response.status(201).json({
    status: "success",
    data: { transfer },
  });
};

export { createInventoryTransferController };
