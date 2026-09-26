import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { getDashboard } from "../services/dashboard.service";

const getDashboardController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const dashboard = await getDashboard(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: dashboard,
  });
};

export { getDashboardController };
