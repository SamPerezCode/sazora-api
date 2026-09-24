import { AppError } from "../../../shared/errors/app-error";
import type {
  CreateInventoryMovementData,
  InventoryMovement,
  InventoryMovementSummary,
} from "../inventory-movement.types";
import {
  createInventoryMovementRecord,
  findInventoryMovementById,
  findInventoryMovements,
} from "../repositories/inventory-movement.repository";

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
  const result = await createInventoryMovementRecord(
    businessId,
    membershipId,
    data,
  );

  if (result.kind === "ITEMS_NOT_AVAILABLE") {
    throw new AppError(
      `Algunos artículos no existen o están inactivos: ${result.inventoryItemIds.join(", ")}`,
      409,
      "INVENTORY_ITEMS_NOT_AVAILABLE",
    );
  }

  if (result.kind === "INSUFFICIENT_STOCK") {
    throw new AppError(
      `Stock insuficiente para el artículo ${result.inventoryItemId}. Disponible: ${result.availableQuantity}`,
      409,
      "INSUFFICIENT_INVENTORY_STOCK",
    );
  }

  return result.movement;
};

export {
  createInventoryMovement,
  getInventoryMovement,
  listInventoryMovements,
};
