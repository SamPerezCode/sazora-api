import type { RequestHandler } from "express";

import { emitInventoryChanged } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";

import {
  initialInventoryValuationSchema,
  inventoryLocationBalanceParamsSchema,
  inventoryLocationBalanceQuerySchema,
} from "../schemas/inventory-location-balance.schema";

import {
  listLocationInventoryBalances,
  valueInitialInventory,
} from "../services/inventory-location-balance.service";

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

const listInventoryLocationBalancesController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const query = inventoryLocationBalanceQuerySchema.parse(request.query);

  const result = await listLocationInventoryBalances(
    auth.businessId,
    query.locationId,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const valueInitialInventoryController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { inventoryItemId, locationId } =
    inventoryLocationBalanceParamsSchema.parse(request.params);

  const input = initialInventoryValuationSchema.parse(request.body);

  const result = await valueInitialInventory(
    auth.businessId,
    auth.membershipId,
    locationId,
    inventoryItemId,
    input,
  );

  emitInventoryChanged(auth.businessId);

  response.status(200).json({
    status: "success",
    data: result,
  });
};

export {
  listInventoryLocationBalancesController,
  valueInitialInventoryController,
};
