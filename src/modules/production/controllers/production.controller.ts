import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  createProductionSchema,
  productionIdParamsSchema,
} from "../schemas/production.schema";
import {
  createProduction,
  getProductionMovement,
  listProductionMovements,
} from "../services/production.service";

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

const listProductionController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);

  const production = await listProductionMovements(auth.businessId);

  response.status(200).json({
    status: "success",
    data: { production },
  });
};

const getProductionController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);

  const { productionId } = productionIdParamsSchema.parse(request.params);

  const production = await getProductionMovement(auth.businessId, productionId);

  response.status(200).json({
    status: "success",
    data: { production },
  });
};

const createProductionController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const input = createProductionSchema.parse(request.body);

  const production = await createProduction(
    auth.businessId,
    auth.membershipId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: { production },
  });
};

export {
  createProductionController,
  getProductionController,
  listProductionController,
};
