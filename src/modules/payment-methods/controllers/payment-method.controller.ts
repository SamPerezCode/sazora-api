import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  createPaymentMethodSchema,
  paymentMethodIdParamsSchema,
  paymentMethodQuerySchema,
  updatePaymentMethodSchema,
  updatePaymentMethodStatusSchema,
} from "../schemas/payment-method.schema";
import {
  changePaymentMethodStatus,
  createPaymentMethod,
  getPaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
} from "../services/payment-method.service";

const requireBusinessId = (request: Parameters<RequestHandler>[0]): string => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth.businessId;
};

const listPaymentMethodsController: RequestHandler = async (
  request,
  response,
) => {
  const businessId = requireBusinessId(request);
  const query = paymentMethodQuerySchema.parse(request.query);

  const paymentMethods = await listPaymentMethods(businessId, query.activeOnly);

  response.status(200).json({
    status: "success",
    data: { paymentMethods },
  });
};

const getPaymentMethodController: RequestHandler = async (
  request,
  response,
) => {
  const businessId = requireBusinessId(request);
  const { paymentMethodId } = paymentMethodIdParamsSchema.parse(request.params);

  const paymentMethod = await getPaymentMethod(businessId, paymentMethodId);

  response.status(200).json({
    status: "success",
    data: { paymentMethod },
  });
};

const createPaymentMethodController: RequestHandler = async (
  request,
  response,
) => {
  const businessId = requireBusinessId(request);
  const input = createPaymentMethodSchema.parse(request.body);

  const paymentMethod = await createPaymentMethod(businessId, input);

  response.status(201).json({
    status: "success",
    data: { paymentMethod },
  });
};

const updatePaymentMethodController: RequestHandler = async (
  request,
  response,
) => {
  const businessId = requireBusinessId(request);
  const { paymentMethodId } = paymentMethodIdParamsSchema.parse(request.params);
  const input = updatePaymentMethodSchema.parse(request.body);

  const paymentMethod = await updatePaymentMethod(
    businessId,
    paymentMethodId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { paymentMethod },
  });
};

const updatePaymentMethodStatusController: RequestHandler = async (
  request,
  response,
) => {
  const businessId = requireBusinessId(request);
  const { paymentMethodId } = paymentMethodIdParamsSchema.parse(request.params);
  const input = updatePaymentMethodStatusSchema.parse(request.body);

  const paymentMethod = await changePaymentMethodStatus(
    businessId,
    paymentMethodId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { paymentMethod },
  });
};

export {
  createPaymentMethodController,
  getPaymentMethodController,
  listPaymentMethodsController,
  updatePaymentMethodController,
  updatePaymentMethodStatusController,
};
