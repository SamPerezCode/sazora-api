import { AppError } from "../../../shared/errors/app-error";

import { findInventoryItemById } from "../../inventory-items/repositories/inventory-item.repository";

import type {
  CreateInventoryPurchasePresentationData,
  InventoryPurchasePresentation,
} from "../inventory-purchase.types";

import {
  findPurchasePresentationByName,
  findPurchasePresentations,
  insertPurchasePresentation,
} from "../repositories/inventory-purchase-presentation.repository";

const listPurchasePresentations = async (
  businessId: string,
  inventoryItemId: string,
): Promise<InventoryPurchasePresentation[]> => {
  const item = await findInventoryItemById(businessId, inventoryItemId);

  if (!item) {
    throw new AppError(
      "El artículo de inventario no existe",
      404,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }

  return findPurchasePresentations(businessId, inventoryItemId);
};

const createPurchasePresentation = async (
  businessId: string,
  inventoryItemId: string,
  data: CreateInventoryPurchasePresentationData,
): Promise<InventoryPurchasePresentation> => {
  const item = await findInventoryItemById(businessId, inventoryItemId);

  if (!item) {
    throw new AppError(
      "El artículo de inventario no existe",
      404,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }

  if (!item.isActive) {
    throw new AppError(
      "El artículo de inventario está inactivo",
      409,
      "INVENTORY_ITEM_INACTIVE",
    );
  }

  const existingPresentation = await findPurchasePresentationByName(
    businessId,
    inventoryItemId,
    data.name,
  );

  if (existingPresentation) {
    throw new AppError(
      "El artículo ya tiene una presentación con ese nombre",
      409,
      "PURCHASE_PRESENTATION_ALREADY_EXISTS",
    );
  }

  return insertPurchasePresentation(businessId, inventoryItemId, data);
};

export { createPurchasePresentation, listPurchasePresentations };
