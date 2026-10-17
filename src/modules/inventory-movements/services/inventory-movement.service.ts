import { AppError } from "../../../shared/errors/app-error";

import type {
  CreateInventoryMovementData,
  InventoryMovement,
  InventoryMovementSummary,
} from "../inventory-movement.types";

import {
  findInventoryMovementById,
  findInventoryMovements,
} from "../repositories/inventory-movement.repository";

import { createValuedInventoryMovementRecord } from "../repositories/valued-inventory-movement.repository";

const listInventoryMovements = async (
  businessId: string,
): Promise<InventoryMovementSummary[]> => findInventoryMovements(businessId);

const getInventoryMovement = async (
  businessId: string,
  inventoryMovementId: string,
): Promise<InventoryMovement> => {
  const movement = await findInventoryMovementById(
    businessId,
    inventoryMovementId,
  );

  if (!movement) {
    throw new AppError(
      "El movimiento de inventario no existe",
      404,
      "INVENTORY_MOVEMENT_NOT_FOUND",
    );
  }

  return movement;
};

const createInventoryMovement = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryMovementData,
): Promise<InventoryMovement> => {
  const result = await createValuedInventoryMovementRecord(
    businessId,
    membershipId,
    data,
  );

  switch (result.kind) {
    case "CREATED":
      return result.movement;

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

    case "ITEMS_NOT_AVAILABLE":
      throw new AppError(
        `Algunos artículos no existen o están inactivos: ${result.inventoryItemIds.join(", ")}`,
        409,
        "INVENTORY_ITEMS_NOT_AVAILABLE",
      );

    case "UNVALUED_STOCK":
      throw new AppError(
        `El artículo ${result.inventoryItemId} tiene existencias sin valorar`,
        409,
        "INVENTORY_STOCK_UNVALUED",
      );

    case "NEGATIVE_STOCK":
      throw new AppError(
        `El artículo ${result.inventoryItemId} tiene saldo negativo (${result.currentStock}) y debe reconciliarse primero`,
        409,
        "NEGATIVE_INVENTORY_STOCK",
      );

    case "INSUFFICIENT_STOCK":
      throw new AppError(
        `Stock insuficiente para el artículo ${result.inventoryItemId}. Disponible: ${result.availableQuantity}; solicitado: ${result.requestedQuantity}`,
        409,
        "INSUFFICIENT_INVENTORY_STOCK",
      );

    case "UNIT_COST_REQUIRED":
      throw new AppError(
        `Debes indicar el costo unitario para ingresar el artículo ${result.inventoryItemId}, porque la ubicación no tiene un costo promedio vigente`,
        409,
        "INVENTORY_UNIT_COST_REQUIRED",
      );

    case "UNIT_COST_NOT_ALLOWED":
      throw new AppError(
        `No debes indicar costo para el artículo ${result.inventoryItemId}; se utilizará el promedio ponderado vigente`,
        409,
        "INVENTORY_UNIT_COST_NOT_ALLOWED",
      );
  }
};

export {
  createInventoryMovement,
  getInventoryMovement,
  listInventoryMovements,
};
