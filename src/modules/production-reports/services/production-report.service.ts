import { AppError } from "../../../shared/errors/app-error";

import type { AuthenticatedSession } from "../../auth/auth.types";

import { findEmployeeByMembershipId } from "../../employees/repositories/employee.repository";

import { findInventoryItemById } from "../../inventory-items/repositories/inventory-item.repository";

import { resolveProductionListScope } from "../../production/services/production-location-access.service";

import { findSalesBusinessContext } from "../../sales-reports/repositories/sales-report.repository";

import { createSalesPeriod } from "../../sales-reports/sales-period";

import {
  findGroupedProductionReport,
  findProductionOrderHistory,
  findProductionReportSummary,
} from "../repositories/production-report.repository";

import type {
  ProductionGroupedReportQuery,
  ProductionOrderHistoryQuery,
  ProductionReportSummaryQuery,
} from "../schemas/production-report.schema";

import type {
  ProductionReportFilters,
  ProductionReportGroupBy,
} from "../production-report.types";

type BaseProductionReportQuery = Readonly<{
  from: string;
  to: string;

  dateField: "CREATED" | "PLANNED" | "STARTED" | "COMPLETED";

  locationId?: string | undefined;

  outputInventoryItemId?: string | undefined;

  membershipId?: string | undefined;

  status?:
    "DRAFT" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;

  search?: string | undefined;
}>;

const validateOutputInventoryItem = async (
  businessId: string,
  inventoryItemId?: string,
): Promise<void> => {
  if (inventoryItemId === undefined) {
    return;
  }

  const inventoryItem = await findInventoryItemById(
    businessId,
    inventoryItemId,
  );

  if (!inventoryItem) {
    throw new AppError(
      "El producto de inventario no existe",
      404,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }
};

const validateEmployee = async (
  businessId: string,
  membershipId?: string,
): Promise<void> => {
  if (membershipId === undefined) {
    return;
  }

  const employee = await findEmployeeByMembershipId(businessId, membershipId);

  if (!employee) {
    throw new AppError(
      "El empleado no existe en este negocio",
      404,
      "EMPLOYEE_NOT_FOUND",
    );
  }
};

const createProductionReportFilters = async (
  auth: AuthenticatedSession,
  query: BaseProductionReportQuery,
  page: number,
  pageSize: number,
): Promise<ProductionReportFilters> => {
  const [business, accessibleLocationIds] = await Promise.all([
    findSalesBusinessContext(auth.businessId),

    resolveProductionListScope(auth, query.locationId),

    validateOutputInventoryItem(auth.businessId, query.outputInventoryItemId),

    validateEmployee(auth.businessId, query.membershipId),
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
    period: {
      from: period.from,
      to: period.to,
      timezone: period.timezone,
      start: period.start,
      end: period.end,
    },

    dateField: query.dateField,

    locationIds: accessibleLocationIds ?? null,

    page,
    pageSize,

    ...(query.outputInventoryItemId !== undefined
      ? {
          outputInventoryItemId: query.outputInventoryItemId,
        }
      : {}),

    ...(query.membershipId !== undefined
      ? {
          membershipId: query.membershipId,
        }
      : {}),

    ...(query.status !== undefined
      ? {
          status: query.status,
        }
      : {}),

    ...(query.search !== undefined
      ? {
          search: query.search,
        }
      : {}),
  };
};

const getProductionOrderHistoryReport = async (
  auth: AuthenticatedSession,
  query: ProductionOrderHistoryQuery,
) => {
  const filters = await createProductionReportFilters(
    auth,
    query,
    query.page,
    query.pageSize,
  );

  const result = await findProductionOrderHistory(auth.businessId, filters);

  return {
    generatedAt: new Date(),

    period: {
      from: filters.period.from,
      to: filters.period.to,
      timezone: filters.period.timezone,
    },

    dateField: filters.dateField,
    ...result,
  };
};

const getProductionSummaryReport = async (
  auth: AuthenticatedSession,
  query: ProductionReportSummaryQuery,
) => {
  const filters = await createProductionReportFilters(auth, query, 1, 1);

  const summary = await findProductionReportSummary(auth.businessId, filters);

  return {
    generatedAt: new Date(),

    period: {
      from: filters.period.from,
      to: filters.period.to,
      timezone: filters.period.timezone,
    },

    dateField: filters.dateField,
    summary,
  };
};

const getGroupedProductionReport = async (
  auth: AuthenticatedSession,
  query: ProductionGroupedReportQuery,
) => {
  const filters = await createProductionReportFilters(auth, query, 1, 1);

  const groupBy: ProductionReportGroupBy = query.groupBy;

  const result = await findGroupedProductionReport(
    auth.businessId,
    filters,
    groupBy,
  );

  return {
    generatedAt: new Date(),

    period: {
      from: filters.period.from,
      to: filters.period.to,
      timezone: filters.period.timezone,
    },

    dateField: filters.dateField,
    ...result,
  };
};

export {
  getGroupedProductionReport,
  getProductionOrderHistoryReport,
  getProductionSummaryReport,
};
