import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  createInventoryItemSchema,
  inventoryItemIdParamsSchema,
  updateInventoryItemSchema,
  updateInventoryItemStatusSchema,
} from "../schemas/inventory-item.schema";
import {
  createInventoryItem,
  getInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  updateInventoryItemStatus,
} from "../services/inventory-item.service";

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

const listInventoryItemsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const items = await listInventoryItems(auth.businessId);

  response.status(200).json({
    status: "success",
    data: { items },
  });
};

const getInventoryItemController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { inventoryItemId } = inventoryItemIdParamsSchema.parse(request.params);

  const item = await getInventoryItem(auth.businessId, inventoryItemId);

  response.status(200).json({
    status: "success",
    data: { item },
  });
};

const createInventoryItemController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const input = createInventoryItemSchema.parse(request.body);

  const item = await createInventoryItem(
    auth.businessId,
    auth.membershipId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: { item },
  });
};

const updateInventoryItemController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { inventoryItemId } = inventoryItemIdParamsSchema.parse(request.params);

  const input = updateInventoryItemSchema.parse(request.body);

  const item = await updateInventoryItem(
    auth.businessId,
    inventoryItemId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { item },
  });
};

const updateInventoryItemStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { inventoryItemId } = inventoryItemIdParamsSchema.parse(request.params);

  const { isActive } = updateInventoryItemStatusSchema.parse(request.body);

  const item = await updateInventoryItemStatus(
    auth.businessId,
    inventoryItemId,
    isActive,
  );

  response.status(200).json({
    status: "success",
    data: { item },
  });
};

export {
  createInventoryItemController,
  getInventoryItemController,
  listInventoryItemsController,
  updateInventoryItemController,
  updateInventoryItemStatusController,
};
