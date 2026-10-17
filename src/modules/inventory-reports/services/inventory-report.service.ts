import { AppError } from "../../../shared/errors/app-error";

import { findInventoryItemById } from "../../inventory-items/repositories/inventory-item.repository";

import { findLocationById } from "../../locations/repositories/location.repository";

import { findSalesBusinessContext } from "../../sales-reports/repositories/sales-report.repository";

import { createSalesPeriod } from "../../sales-reports/sales-period";
import { findInventoryReconciliation } from "../repositories/inventory-report.repository";

import type {
  InventoryKardexQuery,
  InventoryPurchaseReportQuery,
  InventorySummaryQuery,
} from "../schemas/inventory-report.schema";

import type {
  InventoryReportFilters,
  InventoryReportScope,
} from "../inventory-report.types";

import {
  findInventoryKardex,
  findInventoryPurchaseHistory,
  findInventorySummary,
  findInventorySummaryByLocation,
  findUnvaluedInventoryItems,
} from "../repositories/inventory-report.repository";

const resolveScope = async (
  businessId: string,
  locationId?: string,
): Promise<InventoryReportScope> => {
  if (!locationId) {
    return {
      type: "BUSINESS",
      location: null,
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

  return {
    type: "LOCATION",
    location: {
      id: location.id,
      code: location.code,
      name: location.name,
    },
  };
};

const validateInventoryItem = async (
  businessId: string,
  inventoryItemId?: string,
): Promise<void> => {
  if (!inventoryItemId) {
    return;
  }

  const item = await findInventoryItemById(businessId, inventoryItemId);

  if (!item) {
    throw new AppError(
      "El artículo de inventario no existe",
      404,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }
};

const getInventorySummaryReport = async (
  businessId: string,
  query: InventorySummaryQuery,
) => {
  const scope = await resolveScope(businessId, query.locationId);

  const [summary, byLocation] = await Promise.all([
    findInventorySummary(businessId, query.locationId),

    scope.type === "BUSINESS"
      ? findInventorySummaryByLocation(businessId)
      : Promise.resolve([]),
  ]);

  return {
    generatedAt: new Date(),
    scope,
    summary,
    byLocation,
  };
};

const getUnvaluedInventoryReport = async (
  businessId: string,
  query: InventorySummaryQuery,
) => {
  const scope = await resolveScope(businessId, query.locationId);

  const items = await findUnvaluedInventoryItems(businessId, query.locationId);

  return {
    generatedAt: new Date(),
    scope,
    itemCount: items.length,
    items,
  };
};

const createPeriodicFilters = async (
  businessId: string,
  query: InventoryKardexQuery | InventoryPurchaseReportQuery,
): Promise<{
  scope: InventoryReportScope;
  filters: InventoryReportFilters;
}> => {
  const [business, scope] = await Promise.all([
    findSalesBusinessContext(businessId),

    resolveScope(businessId, query.locationId),

    validateInventoryItem(businessId, query.inventoryItemId),
  ]);

  if (!business) {
    throw new AppError(
      "El negocio no existe o está inactivo",
      404,
      "BUSINESS_NOT_FOUND",
    );
  }

  const period = createSalesPeriod(query.from, query.to, business.timezone);

  return {
    scope,

    filters: {
      period,
      page: query.page,
      pageSize: query.pageSize,

      ...(query.locationId ? { locationId: query.locationId } : {}),

      ...(query.inventoryItemId
        ? {
            inventoryItemId: query.inventoryItemId,
          }
        : {}),

      ...("movementType" in query && query.movementType
        ? {
            movementType: query.movementType,
          }
        : {}),
    },
  };
};

const getInventoryKardexReport = async (
  businessId: string,
  query: InventoryKardexQuery,
) => {
  const { scope, filters } = await createPeriodicFilters(businessId, query);

  const result = await findInventoryKardex(businessId, filters);

  return {
    generatedAt: new Date(),
    scope,

    period: {
      from: query.from,
      to: query.to,
      timezone: filters.period?.timezone ?? "UTC",
    },

    ...result,
  };
};

const getInventoryPurchaseReport = async (
  businessId: string,
  query: InventoryPurchaseReportQuery,
) => {
  const { scope, filters } = await createPeriodicFilters(businessId, query);

  const result = await findInventoryPurchaseHistory(businessId, filters);

  return {
    generatedAt: new Date(),
    scope,

    period: {
      from: query.from,
      to: query.to,
      timezone: filters.period?.timezone ?? "UTC",
    },

    ...result,
  };
};

const getInventoryReconciliationReport = async (businessId: string) => {
  const reconciliation = await findInventoryReconciliation(businessId);

  return {
    generatedAt: new Date(),
    ...reconciliation,
  };
};

export {
  getInventoryKardexReport,
  getInventoryPurchaseReport,
  getInventorySummaryReport,
  getUnvaluedInventoryReport,
  getInventoryReconciliationReport,
};
