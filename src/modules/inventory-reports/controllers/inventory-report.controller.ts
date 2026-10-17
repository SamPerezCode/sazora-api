import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";

import {
  inventoryKardexQuerySchema,
  inventoryPurchaseReportQuerySchema,
  inventorySummaryQuerySchema,
} from "../schemas/inventory-report.schema";

import {
  getInventoryKardexReport,
  getInventoryPurchaseReport,
  getInventorySummaryReport,
  getUnvaluedInventoryReport,
} from "../services/inventory-report.service";
import { getInventoryReconciliationReport } from "../services/inventory-report.service";

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

const getInventorySummaryController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const query = inventorySummaryQuerySchema.parse(request.query);

  const report = await getInventorySummaryReport(auth.businessId, query);

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

  const report = await getUnvaluedInventoryReport(auth.businessId, query);

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

  const report = await getInventoryKardexReport(auth.businessId, query);

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

  const report = await getInventoryPurchaseReport(auth.businessId, query);

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

  const report = await getInventoryReconciliationReport(auth.businessId);

  response.status(200).json({
    status: "success",
    data: report,
  });
};

export {
  getInventoryKardexController,
  getInventoryPurchaseReportController,
  getInventorySummaryController,
  getUnvaluedInventoryController,
  getInventoryReconciliationController,
};
