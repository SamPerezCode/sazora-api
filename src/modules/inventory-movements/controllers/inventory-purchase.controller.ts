import type { RequestHandler } from "express";

import { emitInventoryChanged } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";

import {
  createInventoryPurchaseSchema,
  createPurchasePresentationSchema,
  inventoryItemParamsSchema,
} from "../schemas/inventory-purchase.schema";

import {
  createInventoryPurchase,
  getInventoryPurchase,
} from "../services/inventory-purchase.service";

import {
  createPurchasePresentation,
  listPurchasePresentations,
} from "../services/inventory-purchase-presentation.service";

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

const listPurchasePresentationsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { inventoryItemId } = inventoryItemParamsSchema.parse(request.params);

  const presentations = await listPurchasePresentations(
    auth.businessId,
    inventoryItemId,
  );

  response.status(200).json({
    status: "success",
    data: { presentations },
  });
};

const createPurchasePresentationController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { inventoryItemId } = inventoryItemParamsSchema.parse(request.params);

  const input = createPurchasePresentationSchema.parse(request.body);

  const presentation = await createPurchasePresentation(
    auth.businessId,
    inventoryItemId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: { presentation },
  });
};

const createInventoryPurchaseController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const input = createInventoryPurchaseSchema.parse(request.body);

  const purchase = await createInventoryPurchase(
    auth.businessId,
    auth.membershipId,
    input,
  );

  emitInventoryChanged(auth.businessId);

  response.status(201).json({
    status: "success",
    data: { purchase },
  });
};

const getInventoryPurchaseController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { inventoryMovementId } = request.params;

  if (
    typeof inventoryMovementId !== "string" ||
    !/^[1-9]\d*$/.test(inventoryMovementId)
  ) {
    throw new AppError(
      "El identificador no es válido",
      400,
      "INVALID_INVENTORY_PURCHASE_ID",
    );
  }

  const purchase = await getInventoryPurchase(
    auth.businessId,
    inventoryMovementId,
  );

  response.status(200).json({
    status: "success",
    data: { purchase },
  });
};

export {
  createInventoryPurchaseController,
  createPurchasePresentationController,
  getInventoryPurchaseController,
  listPurchasePresentationsController,
};
