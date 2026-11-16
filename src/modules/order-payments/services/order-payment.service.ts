import { AppError } from "../../../shared/errors/app-error";
import { findOrderDetailById } from "../../orders/repositories/get-order.repository";
import type { RecordOrderPaymentInput } from "../schemas/order-payment.schema";

import {
  findOrderPaymentBatch,
  recordOrderPayment,
} from "../repositories/order-payment.repository";

const getOrderPayment = async (businessId: string, orderId: string) => {
  const order = await findOrderDetailById(businessId, orderId);

  if (!order) {
    throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");
  }

  return findOrderPaymentBatch(businessId, orderId);
};

const verifyOrderPayment = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  input: RecordOrderPaymentInput,
) => {
  const result = await recordOrderPayment(businessId, orderId, {
    cashSessionId: input.cashSessionId,
    verifiedByMembershipId: membershipId,
    idempotencyKey: input.idempotencyKey,
    payments: input.payments,
  });

  switch (result.kind) {
    case "RECORDED":
      return {
        created: result.created,
        paymentBatch: result.paymentBatch,
      };

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "TABLE_ORDER_NOT_PREPAID":
      throw new AppError(
        "Las órdenes de mesa se pagan después del consumo",
        409,
        "TABLE_ORDER_NOT_PREPAID",
      );

    case "ORDER_NOT_OPEN":
      throw new AppError(
        "Solo se puede registrar el pago anticipado de una orden abierta",
        409,
        "ORDER_NOT_OPEN",
      );

    case "ORDER_ALREADY_PAID":
      throw new AppError(
        "La orden ya tiene un pago anticipado registrado",
        409,
        "ORDER_ALREADY_PAID",
      );

    case "IDEMPOTENCY_KEY_CONFLICT":
      throw new AppError(
        "La clave de idempotencia ya fue utilizada",
        409,
        "IDEMPOTENCY_KEY_CONFLICT",
      );

    case "CASH_SESSION_NOT_FOUND":
      throw new AppError(
        "El turno de caja no existe",
        404,
        "CASH_SESSION_NOT_FOUND",
      );

    case "CASH_SESSION_NOT_OPEN":
      throw new AppError(
        "El turno de caja no está abierto",
        409,
        "CASH_SESSION_NOT_OPEN",
      );

    case "CASH_SESSION_LOCATION_MISMATCH":
      throw new AppError(
        "El turno de caja no pertenece a la ubicación de la orden",
        409,
        "CASH_SESSION_LOCATION_MISMATCH",
      );

    case "PAYMENT_METHOD_NOT_AVAILABLE":
      throw new AppError(
        `La forma de pago ${result.paymentMethodId} no está disponible`,
        409,
        "PAYMENT_METHOD_NOT_AVAILABLE",
      );

    case "PAYMENT_REFERENCE_REQUIRED":
      throw new AppError(
        `La forma de pago ${result.paymentMethodName} requiere referencia`,
        400,
        "PAYMENT_REFERENCE_REQUIRED",
      );
  }
};

export { getOrderPayment, verifyOrderPayment };
