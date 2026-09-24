import { AppError } from "../../../shared/errors/app-error";
import type {
  InventoryMovement,
  InventoryMovementSummary,
} from "../../inventory-movements/inventory-movement.types";
import {
  createInventoryMovementRecord,
  findInventoryMovementById,
  findInventoryMovements,
} from "../../inventory-movements/repositories/inventory-movement.repository";
import type { CreateProductionData } from "../production.types";

const listProductionMovements = async (
  businessId: string,
): Promise<InventoryMovementSummary[]> =>
  findInventoryMovements(businessId, "PRODUCTION");

const getProductionMovement = async (
  businessId: string,
  productionId: string,
): Promise<InventoryMovement> => {
  const movement = await findInventoryMovementById(businessId, productionId);

  if (movement?.movementType !== "PRODUCTION") {
    throw new AppError(
      "El movimiento de producción no existe",
      404,
      "PRODUCTION_NOT_FOUND",
    );
  }

  return movement;
};

const createProduction = async (
  businessId: string,
  membershipId: string,
  data: CreateProductionData,
): Promise<InventoryMovement> => {
  const result = await createInventoryMovementRecord(businessId, membershipId, {
    movementType: "PRODUCTION",
    notes: data.notes,
    lines: [
      ...data.inputs.map((input) => ({
        inventoryItemId: input.inventoryItemId,
        direction: "OUT" as const,
        quantity: input.quantity,
        notes: input.notes,
      })),
      ...data.outputs.map((output) => ({
        inventoryItemId: output.inventoryItemId,
        direction: "IN" as const,
        quantity: output.quantity,
        notes: output.notes,
      })),
    ],
  });

  if (result.kind === "ITEMS_NOT_AVAILABLE") {
    throw new AppError(
      `Algunos artículos no existen o están inactivos: ${result.inventoryItemIds.join(", ")}`,
      409,
      "INVENTORY_ITEMS_NOT_AVAILABLE",
    );
  }

  if (result.kind === "INSUFFICIENT_STOCK") {
    throw new AppError(
      `Stock insuficiente para el insumo ${result.inventoryItemId}. Disponible: ${result.availableQuantity}`,
      409,
      "INSUFFICIENT_PRODUCTION_STOCK",
    );
  }

  return result.movement;
};

export { createProduction, getProductionMovement, listProductionMovements };
