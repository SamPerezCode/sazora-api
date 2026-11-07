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
import { resolveAssignedInventoryLocation } from "../services/inventory-location-access.service";
import { resolveProductionInventoryLocation } from "../services/production-inventory-access.service";

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

  let locationId: string | undefined;

  if (auth.locationAccess.hasGlobalAccess) {
    /*
     * ADMIN conserva el comportamiento actual:
     * puede consultar una ubicación o el consolidado del negocio.
     */
    locationId = query.locationId;
  } else if (!auth.permissions.includes("inventory.items.manage")) {
    /*
     * PRODUCTION continúa limitado exclusivamente
     * a su planta predeterminada válida.
     */
    locationId = await resolveProductionInventoryLocation(
      auth,
      query.locationId,
    );
  } else {
    /*
     * INVENTORY_MANAGER puede consultar únicamente
     * ubicaciones de inventario que tenga asignadas.
     *
     * Si omite locationId se utiliza su ubicación predeterminada.
     * Nunca obtiene un consolidado global.
     */
    locationId = await resolveAssignedInventoryLocation(auth, query.locationId);
  }

  const result = await listLocationInventoryBalances(
    auth.businessId,
    locationId,
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

  const { inventoryItemId, locationId: requestedLocationId } =
    inventoryLocationBalanceParamsSchema.parse(request.params);

  const input = initialInventoryValuationSchema.parse(request.body);

  const locationId = auth.locationAccess.hasGlobalAccess
    ? requestedLocationId
    : await resolveAssignedInventoryLocation(auth, requestedLocationId);

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
