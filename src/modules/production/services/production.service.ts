import { AppError } from "../../../shared/errors/app-error";

import type { AuthenticatedSession } from "../../auth/auth.types";

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

import {
  assertProductionMovementAccess,
  resolveProductionListScope,
  resolveProductionLocation,
} from "./production-location-access.service";

const listProductionMovements = async (
  auth: AuthenticatedSession,
  requestedLocationId?: string,
): Promise<InventoryMovementSummary[]> => {
  const locationIds = await resolveProductionListScope(
    auth,
    requestedLocationId,
  );

  return findInventoryMovements(auth.businessId, "PRODUCTION", locationIds);
};

const getProductionMovement = async (
  auth: AuthenticatedSession,
  productionId: string,
): Promise<InventoryMovement> => {
  const movement = await findInventoryMovementById(
    auth.businessId,
    productionId,
  );

  if (movement?.movementType !== "PRODUCTION") {
    throw new AppError(
      "El movimiento de producción no existe",
      404,
      "PRODUCTION_NOT_FOUND",
    );
  }

  assertProductionMovementAccess(auth, movement);

  return movement;
};

const createProduction = async (
  auth: AuthenticatedSession,
  data: CreateProductionData,
): Promise<InventoryMovement> => {
  const locationId = await resolveProductionLocation(auth, data.locationId);

  return createValuedProductionRecord(auth.businessId, auth.membershipId, {
    ...data,
    locationId,
  });
};

export { createProduction, getProductionMovement, listProductionMovements };
