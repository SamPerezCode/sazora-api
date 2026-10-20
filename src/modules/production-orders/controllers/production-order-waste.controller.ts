import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";

import {
  createProductionOrderWasteSchema,
  productionOrderWasteParamsSchema,
} from "../schemas/production-order-waste.schema";

import { productionOrderParamsSchema } from "../schemas/production-order.schema";

import {
  createProductionOrderWaste,
  getProductionOrderWaste,
  listProductionOrderWaste,
} from "../services/production-order-waste.service";

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

const listProductionOrderWasteController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionOrderId } = productionOrderParamsSchema.parse(
    request.params,
  );

  const wasteRecords = await listProductionOrderWaste(auth, productionOrderId);

  response.status(200).json({
    status: "success",
    data: { wasteRecords },
  });
};

const getProductionOrderWasteController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionOrderId, wasteRecordId } =
    productionOrderWasteParamsSchema.parse(request.params);

  const wasteRecord = await getProductionOrderWaste(
    auth,
    productionOrderId,
    wasteRecordId,
  );

  response.status(200).json({
    status: "success",
    data: { wasteRecord },
  });
};

const createProductionOrderWasteController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionOrderId } = productionOrderParamsSchema.parse(
    request.params,
  );

  const input = createProductionOrderWasteSchema.parse(request.body);

  const result = await createProductionOrderWaste(
    auth,
    productionOrderId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: result,
  });
};

export {
  createProductionOrderWasteController,
  getProductionOrderWasteController,
  listProductionOrderWasteController,
};
