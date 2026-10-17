import type { RequestHandler } from "express";

import type { AuthenticatedSession } from "../../auth/auth.types";

import { AppError } from "../../../shared/errors/app-error";

import { cancellationReportQuerySchema } from "../schemas/cancellation-report.schema";

import { kitchenOperationReportQuerySchema } from "../schemas/kitchen-operation-report.schema";

import { salesReportQuerySchema } from "../schemas/sales-report.schema";

import { getCancellationReport } from "../services/cancellation-report.service";

import { getKitchenOperationReport } from "../services/kitchen-operation-report.service";

import { getSalesReport } from "../services/sales-report.service";

const requireAuthentication = (
  auth: AuthenticatedSession | undefined,
): AuthenticatedSession => {
  if (!auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return auth;
};

const getSalesReportController: RequestHandler = async (request, response) => {
  const auth = requireAuthentication(request.auth);

  const query = salesReportQuerySchema.parse(request.query);

  const report = await getSalesReport(auth.businessId, query);

  response.status(200).json({
    status: "success",
    data: report,
  });
};

const getCancellationReportController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuthentication(request.auth);

  const query = cancellationReportQuerySchema.parse(request.query);

  const report = await getCancellationReport(auth.businessId, query);

  response.status(200).json({
    status: "success",
    data: report,
  });
};

const getKitchenOperationReportController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuthentication(request.auth);

  const query = kitchenOperationReportQuerySchema.parse(request.query);

  const report = await getKitchenOperationReport(auth.businessId, query);

  response.status(200).json({
    status: "success",
    data: report,
  });
};

export {
  getCancellationReportController,
  getKitchenOperationReportController,
  getSalesReportController,
};
