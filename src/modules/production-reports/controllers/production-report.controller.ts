import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";

import {
  productionGroupedReportQuerySchema,
  productionOrderHistoryQuerySchema,
  productionReportSummaryQuerySchema,
} from "../schemas/production-report.schema";

import {
  getGroupedProductionReport,
  getProductionOrderHistoryReport,
  getProductionSummaryReport,
} from "../services/production-report.service";

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

const getProductionOrderHistoryController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const query = productionOrderHistoryQuerySchema.parse(request.query);

  const report = await getProductionOrderHistoryReport(auth, query);

  response.status(200).json({
    status: "success",
    data: { report },
  });
};

const getProductionSummaryController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const query = productionReportSummaryQuerySchema.parse(request.query);

  const report = await getProductionSummaryReport(auth, query);

  response.status(200).json({
    status: "success",
    data: { report },
  });
};

const getGroupedProductionReportController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const query = productionGroupedReportQuerySchema.parse(request.query);

  const report = await getGroupedProductionReport(auth, query);

  response.status(200).json({
    status: "success",
    data: { report },
  });
};

export {
  getGroupedProductionReportController,
  getProductionOrderHistoryController,
  getProductionSummaryController,
};
