import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";

import { productionOrderParamsSchema } from "../schemas/production-order.schema";

import { getProductionOrderPerformance } from "../services/production-order-performance.service";

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

const getProductionOrderPerformanceController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionOrderId } = productionOrderParamsSchema.parse(
    request.params,
  );

  const performance = await getProductionOrderPerformance(
    auth,
    productionOrderId,
  );

  response.status(200).json({
    status: "success",
    data: { performance },
  });
};

export { getProductionOrderPerformanceController };
