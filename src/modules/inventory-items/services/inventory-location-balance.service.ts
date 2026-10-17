import { findLocationById } from "../../locations/repositories/location.repository";

import { AppError } from "../../../shared/errors/app-error";

import type {
  InitialInventoryValuationData,
  InventoryLocationBalanceResult,
} from "../inventory-location-balance.types";

import { findInventoryItemById } from "../repositories/inventory-item.repository";

import {
  findInventoryLocationBalances,
  valueInitialInventoryBalance,
} from "../repositories/inventory-location-balance.repository";

const calculateSummary = (
  balances: InventoryLocationBalanceResult["balances"],
): InventoryLocationBalanceResult["summary"] => {
  const valuedBalances = balances.filter(
    (balance) => balance.valuationStatus === "VALUED",
  );

  const unvaluedBalances = balances.filter(
    (balance) => balance.valuationStatus === "UNVALUED",
  );

  const hasUnvaluedStock = unvaluedBalances.some(
    (balance) => Number(balance.currentStock) !== 0,
  );

  const totalInventoryValue = hasUnvaluedStock
    ? null
    : valuedBalances
        .reduce(
          (total, balance) => total + Number(balance.inventoryValue ?? "0"),
          0,
        )
        .toFixed(6);

  return {
    itemCount: balances.length,
    valuedItemCount: valuedBalances.length,
    unvaluedItemCount: unvaluedBalances.length,
    totalInventoryValue,
    hasUnvaluedStock,
  };
};

const listLocationInventoryBalances = async (
  businessId: string,
  locationId?: string,
): Promise<InventoryLocationBalanceResult> => {
  if (!locationId) {
    const balances = await findInventoryLocationBalances(businessId);

    return {
      scope: {
        type: "BUSINESS",
        location: null,
      },
      balances,
      summary: calculateSummary(balances),
    };
  }

  const location = await findLocationById(businessId, locationId);

  if (!location) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  if (!location.isInventoryLocation) {
    throw new AppError(
      "La ubicación no administra inventario",
      409,
      "LOCATION_NOT_INVENTORY_ENABLED",
    );
  }

  const balances = await findInventoryLocationBalances(businessId, locationId);

  return {
    scope: {
      type: "LOCATION",
      location: {
        id: location.id,
        code: location.code,
        name: location.name,
      },
    },

    balances,
    summary: calculateSummary(balances),
  };
};

const valueInitialInventory = async (
  businessId: string,
  membershipId: string,
  locationId: string,
  inventoryItemId: string,
  data: InitialInventoryValuationData,
) => {
  const [location, item] = await Promise.all([
    findLocationById(businessId, locationId),

    findInventoryItemById(businessId, inventoryItemId),
  ]);

  if (!location) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  if (!location.isActive) {
    throw new AppError("La ubicación está inactiva", 409, "LOCATION_INACTIVE");
  }

  if (!location.isInventoryLocation) {
    throw new AppError(
      "La ubicación no administra inventario",
      409,
      "LOCATION_NOT_INVENTORY_ENABLED",
    );
  }

  if (!item) {
    throw new AppError(
      "El artículo de inventario no existe",
      404,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }

  const result = await valueInitialInventoryBalance(
    businessId,
    membershipId,
    locationId,
    inventoryItemId,
    data,
  );

  switch (result.kind) {
    case "VALUED":
      return {
        balance: result.balance,
        valuationEvent: result.event,
      };

    case "BALANCE_NOT_FOUND":
      throw new AppError(
        "El artículo no tiene existencias registradas en esta ubicación",
        404,
        "INVENTORY_LOCATION_BALANCE_NOT_FOUND",
      );

    case "BALANCE_ALREADY_VALUED":
      throw new AppError(
        "El inventario ya tiene un costo asignado en esta ubicación",
        409,
        "INVENTORY_BALANCE_ALREADY_VALUED",
      );

    case "BALANCE_HAS_NO_STOCK":
      throw new AppError(
        "No es necesario valorar un saldo en cero",
        409,
        "INVENTORY_BALANCE_HAS_NO_STOCK",
      );
  }
};

export { listLocationInventoryBalances, valueInitialInventory };
