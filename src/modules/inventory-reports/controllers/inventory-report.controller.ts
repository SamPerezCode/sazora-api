import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import type { AuthenticatedSession } from "../../auth/auth.types";
import { resolveAssignedInventoryLocation } from "../../inventory-items/services/inventory-location-access.service";

import {
  inventoryKardexQuerySchema,
  inventoryPurchaseReportQuerySchema,
  inventorySummaryQuerySchema,
} from "../schemas/inventory-report.schema";

import {
  getInventoryKardexReport,
  getInventoryPurchaseReport,
  getInventoryReconciliationReport,
  getInventorySummaryReport,
  getUnvaluedInventoryReport,
} from "../services/inventory-report.service";

const requireAuth = (
  request: Parameters<RequestHandler>[0],
): AuthenticatedSession => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const resolveReportLocationId = async (
  auth: AuthenticatedSession,
  requestedLocationId?: string,
): Promise<string | undefined> => {
  if (auth.locationAccess.hasGlobalAccess) {
    return requestedLocationId;
  }

  return resolveAssignedInventoryLocation(auth, requestedLocationId);
};

const getInventorySummaryController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = inventorySummaryQuerySchema.parse(request.query);

  const locationId = await resolveReportLocationId(auth, query.locationId);

  const report = await getInventorySummaryReport(auth.businessId, {
    ...query,
    locationId,
  });

  response.status(200).json({
    status: "success",
    data: report,
  });
};

const getUnvaluedInventoryController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = inventorySummaryQuerySchema.parse(request.query);

  const locationId = await resolveReportLocationId(auth, query.locationId);

  const report = await getUnvaluedInventoryReport(auth.businessId, {
    ...query,
    locationId,
  });

  response.status(200).json({
    status: "success",
    data: report,
  });
};

const getInventoryKardexController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = inventoryKardexQuerySchema.parse(request.query);

  const locationId = await resolveReportLocationId(auth, query.locationId);

  const report = await getInventoryKardexReport(auth.businessId, {
    ...query,
    locationId,
  });

  response.status(200).json({
    status: "success",
    data: report,
  });
};

const getInventoryPurchaseReportController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = inventoryPurchaseReportQuerySchema.parse(request.query);

  const locationId = await resolveReportLocationId(auth, query.locationId);

  const report = await getInventoryPurchaseReport(auth.businessId, {
    ...query,
    locationId,
  });

  response.status(200).json({
    status: "success",
    data: report,
  });
};

const getInventoryReconciliationController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  /*
   * La conciliación actual es global porque compara:
   *
   * inventory_items.current_stock
   * contra
   * la suma de inventory_location_balances.
   *
   * No debe mostrarse parcialmente por ubicación porque produciría
   * diferencias engañosas.
   */
  if (!auth.locationAccess.hasGlobalAccess) {
    throw new AppError(
      "La conciliación global requiere acceso a todas las ubicaciones",
      403,
      "GLOBAL_INVENTORY_ACCESS_REQUIRED",
    );
  }

  const report = await getInventoryReconciliationReport(auth.businessId);

  response.status(200).json({
    status: "success",
    data: report,
  });
};

export {
  getInventoryKardexController,
  getInventoryPurchaseReportController,
  getInventoryReconciliationController,
  getInventorySummaryController,
  getUnvaluedInventoryController,
};
