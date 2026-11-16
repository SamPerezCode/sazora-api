import { AppError } from "../../../shared/errors/app-error";
import type { RefundOrderPaymentInput } from "../schemas/refund-order-payment.schema";
import { findOrderPaymentBatch } from "../repositories/order-payment.repository";
import { refundOrderPayment as refundOrderPaymentRecord } from "../repositories/refund-order-payment.repository";

const refundOrderPayment = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  input: RefundOrderPaymentInput,
) => {
  const result = await refundOrderPaymentRecord(businessId, orderId, {
    cashSessionId: input.cashSessionId,
    processedByMembershipId: membershipId,
    reason: input.reason,
    payments: input.payments,
  });

  switch (result.kind) {
    case "REFUNDED": {
      const paymentBatch = await findOrderPaymentBatch(businessId, orderId);

      if (!paymentBatch) {
        throw new Error("No fue posible recuperar el lote de pago devuelto");
      }

      return {
        refund: result.refund,
        paymentBatch,
      };
    }

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_REFUNDABLE":
      throw new AppError(
        `No se puede devolver el pago de una orden en estado ` +
          `${result.orderStatus} con pago ${result.paymentStatus}`,
        409,
        "ORDER_PAYMENT_NOT_REFUNDABLE",
      );

    case "PAYMENT_BATCH_NOT_FOUND":
      throw new AppError(
        "La orden no tiene un lote de pago anticipado verificable",
        409,
        "PAYMENT_BATCH_NOT_FOUND",
      );

    case "PAYMENT_SET_MISMATCH":
      throw new AppError(
        "Debes devolver todos los medios del pago anticipado",
        409,
        "PAYMENT_SET_MISMATCH",
      );

    case "PAYMENT_REFERENCE_REQUIRED":
      throw new AppError(
        `La devolución mediante ${result.paymentMethodName} requiere referencia`,
        400,
        "PAYMENT_REFERENCE_REQUIRED",
      );

    case "CASH_SESSION_REQUIRED":
      throw new AppError(
        "Debes seleccionar un turno abierto para devolver el efectivo",
        400,
        "CASH_SESSION_REQUIRED",
      );

    case "CASH_SESSION_NOT_FOUND":
      throw new AppError(
        "El turno de caja no existe",
        404,
        "CASH_SESSION_NOT_FOUND",
      );

    case "CASH_SESSION_NOT_OPEN":
      throw new AppError(
        "El turno de caja está cerrado",
        409,
        "CASH_SESSION_NOT_OPEN",
      );

    case "CASH_SESSION_LOCATION_MISMATCH":
      throw new AppError(
        "El turno de caja pertenece a otra ubicación",
        409,
        "CASH_SESSION_LOCATION_MISMATCH",
      );

    case "INSUFFICIENT_CASH":
      throw new AppError(
        `La caja tiene ${result.expectedCashAmount} disponibles y ` +
          `la devolución requiere ${result.requiredCashAmount}`,
        409,
        "INSUFFICIENT_CASH_FOR_REFUND",
      );
  }
};

export { refundOrderPayment };
