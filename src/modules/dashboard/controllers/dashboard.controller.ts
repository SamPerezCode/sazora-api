import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { resolveScopedLocationId } from "../../auth/services/scoped-location.service";
import { dashboardQuerySchema } from "../schemas/dashboard.schema";
import { getDashboard } from "../services/dashboard.service";

const getDashboardController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const query = dashboardQuerySchema.parse(request.query);

  const locationId = resolveScopedLocationId(request.auth, query.locationId);

  const dashboard = await getDashboard(request.auth.businessId, {
    ...query,
    ...(locationId ? { locationId } : {}),
  });

  response.status(200).json({
    status: "success",
    data: dashboard,
  });
};

export { getDashboardController };
