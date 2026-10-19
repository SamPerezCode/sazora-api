import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";

import {
  createProductionOrderSchema,
  productionOrderListQuerySchema,
  productionOrderParamsSchema,
  startProductionOrderSchema,
  updateProductionOrderSchema,
  updateProductionOrderStatusSchema,
} from "../schemas/production-order.schema";

import {
  createProductionOrder,
  getProductionOrder,
  listProductionOrders,
  startProductionOrder,
  updateProductionOrder,
  updateProductionOrderStatus,
} from "../services/production-order.service";

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

const listProductionOrdersController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const query = productionOrderListQuerySchema.parse(request.query);

  const productionOrders = await listProductionOrders(auth, query);

  response.status(200).json({
    status: "success",
    data: { productionOrders },
  });
};

const getProductionOrderController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionOrderId } = productionOrderParamsSchema.parse(
    request.params,
  );

  const productionOrder = await getProductionOrder(auth, productionOrderId);

  response.status(200).json({
    status: "success",
    data: { productionOrder },
  });
};

const createProductionOrderController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const input = createProductionOrderSchema.parse(request.body);

  const productionOrder = await createProductionOrder(auth, input);

  response.status(201).json({
    status: "success",
    data: { productionOrder },
  });
};

const updateProductionOrderController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionOrderId } = productionOrderParamsSchema.parse(
    request.params,
  );

  const input = updateProductionOrderSchema.parse(request.body);

  const productionOrder = await updateProductionOrder(
    auth,
    productionOrderId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { productionOrder },
  });
};

const updateProductionOrderStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionOrderId } = productionOrderParamsSchema.parse(
    request.params,
  );

  const input = updateProductionOrderStatusSchema.parse(request.body);

  const productionOrder = await updateProductionOrderStatus(
    auth,
    productionOrderId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { productionOrder },
  });
};

const startProductionOrderController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productionOrderId } = productionOrderParamsSchema.parse(
    request.params,
  );

  const input = startProductionOrderSchema.parse(request.body);

  const productionOrder = await startProductionOrder(
    auth,
    productionOrderId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { productionOrder },
  });
};

export {
  createProductionOrderController,
  getProductionOrderController,
  listProductionOrdersController,
  startProductionOrderController,
  updateProductionOrderController,
  updateProductionOrderStatusController,
};
