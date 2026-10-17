import { AppError } from "../../../shared/errors/app-error";

import type {
  InventoryMovement,
  InventoryMovementSummary,
} from "../../inventory-movements/inventory-movement.types";

import {
  findInventoryMovementById,
  findInventoryMovements,
} from "../../inventory-movements/repositories/inventory-movement.repository";

import type { CreateProductionData } from "../production.types";

import { createValuedProductionRecord } from "../repositories/valued-production.repository";

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
): Promise<InventoryMovement> =>
  createValuedProductionRecord(businessId, membershipId, data);

export { createProduction, getProductionMovement, listProductionMovements };
