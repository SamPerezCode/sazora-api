import { AppError } from "../../../shared/errors/app-error";

import type {
  CreateInventoryPurchaseData,
  InventoryPurchase,
} from "../inventory-purchase.types";

import {
  createInventoryPurchaseRecord,
  findInventoryPurchaseById,
} from "../repositories/inventory-purchase.repository";

const getInventoryPurchase = async (
  businessId: string,
  movementId: string,
): Promise<InventoryPurchase> => {
  const purchase = await findInventoryPurchaseById(businessId, movementId);

  if (!purchase) {
    throw new AppError(
      "La compra de inventario no existe",
      404,
      "INVENTORY_PURCHASE_NOT_FOUND",
    );
  }

  return purchase;
};

const createInventoryPurchase = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryPurchaseData,
): Promise<InventoryPurchase> => {
  const result = await createInventoryPurchaseRecord(
    businessId,
    membershipId,
    data,
  );

  switch (result.kind) {
    case "CREATED":
      return result.purchase;

    case "LOCATION_NOT_FOUND":
      throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");

    case "LOCATION_INACTIVE":
      throw new AppError(
        "La ubicación está inactiva",
        409,
        "LOCATION_INACTIVE",
      );

    case "LOCATION_NOT_INVENTORY_ENABLED":
      throw new AppError(
        "La ubicación no administra inventario",
        409,
        "LOCATION_NOT_INVENTORY_ENABLED",
      );

    case "PRESENTATIONS_NOT_AVAILABLE":
      throw new AppError(
        `Algunas presentaciones no existen o están inactivas: ${result.presentationIds.join(", ")}`,
        409,
        "PURCHASE_PRESENTATIONS_NOT_AVAILABLE",
      );

    case "PRESENTATION_ITEM_MISMATCH":
      throw new AppError(
        `La presentación ${result.presentationId} no pertenece al artículo ${result.inventoryItemId}`,
        409,
        "PURCHASE_PRESENTATION_ITEM_MISMATCH",
      );

    case "UNVALUED_STOCK":
      throw new AppError(
        `El artículo ${result.inventoryItemId} tiene existencias sin valorar. Debes registrar primero su valoración inicial`,
        409,
        "INVENTORY_STOCK_UNVALUED",
      );

    case "NEGATIVE_STOCK":
      throw new AppError(
        `El artículo ${result.inventoryItemId} tiene saldo negativo (${result.currentStock}). Debe reconciliarse antes de registrar una compra`,
        409,
        "NEGATIVE_INVENTORY_STOCK",
      );

    case "BASE_QUANTITY_TOO_SMALL":
      throw new AppError(
        `La conversión del artículo ${result.inventoryItemId} produce una cantidad base menor a 0.001`,
        409,
        "PURCHASE_BASE_QUANTITY_TOO_SMALL",
      );
  }
};

export { createInventoryPurchase, getInventoryPurchase };
