import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import type { AuthenticatedSession } from "../../auth/auth.types";
import { assertOrderLocationAccess } from "../../orders/services/order-location-access.service";

import {
  orderPaymentParamsSchema,
  recordOrderPaymentSchema,
} from "../schemas/order-payment.schema";

import {
  getOrderPayment,
  verifyOrderPayment,
} from "../services/order-payment.service";

const requireAuth = (
  request: Parameters<RequestHandler>[0],
): AuthenticatedSession => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const getOrderPaymentController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { orderId } = orderPaymentParamsSchema.parse(request.params);

  await assertOrderLocationAccess(auth, orderId);

  const paymentBatch = await getOrderPayment(auth.businessId, orderId);

  response.status(200).json({
    status: "success",
    data: {
      paymentBatch,
    },
  });
};

const verifyOrderPaymentController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { orderId } = orderPaymentParamsSchema.parse(request.params);
  const input = recordOrderPaymentSchema.parse(request.body);

  await assertOrderLocationAccess(auth, orderId);

  const result = await verifyOrderPayment(
    auth.businessId,
    auth.membershipId,
    orderId,
    input,
  );

  response.status(result.created ? 201 : 200).json({
    status: "success",
    data: {
      paymentBatch: result.paymentBatch,
    },
  });
};

export { getOrderPaymentController, verifyOrderPaymentController };
