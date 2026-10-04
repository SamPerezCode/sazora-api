import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { salesReportQuerySchema } from "../schemas/sales-report.schema";
import { getSalesReport } from "../services/sales-report.service";

const getSalesReportController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const query = salesReportQuerySchema.parse(request.query);

  const report = await getSalesReport(request.auth.businessId, query);

  response.status(200).json({
    status: "success",
    data: report,
  });
};

export { getSalesReportController };
