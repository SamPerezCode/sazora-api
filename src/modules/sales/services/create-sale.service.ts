import { AppError } from "../../../shared/errors/app-error";
import { findOrderPaymentBatch } from "../../order-payments/repositories/order-payment.repository";
import { findPaymentMethodById } from "../../payment-methods/repositories/payment-method.repository";

import {
  createSaleRecord,
  findOrderSaleState,
} from "../repositories/create-sale.repository";

import { findSaleById } from "../repositories/get-sale.repository";
import type { CreateSaleInput } from "../schemas/create-sale.schema";
import { calculateSaleSettlement } from "../sale-settlement-calculation";
import type { CreateSaleData, ResolvedSalePayment, Sale } from "../sale.types";

const createSale = async (
  businessId: string,
  membershipId: string,
  input: CreateSaleInput,
): Promise<Sale> => {
  const order = await findOrderSaleState(businessId, input.orderId);

  if (!order) {
    throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");
  }

  if (order.status !== "DELIVERED") {
    throw new AppError(
      "La venta solamente puede cerrarse cuando la orden está entregada",
      409,
      "ORDER_NOT_DELIVERED",
    );
  }

  const advancePayment =
    order.paymentStatus === "VERIFIED"
      ? await findOrderPaymentBatch(businessId, input.orderId)
      : null;

  let data: CreateSaleData;

  if (order.paymentStatus === "VERIFIED") {
    if (advancePayment?.status !== "VERIFIED") {
      throw new AppError(
        "La orden indica un pago verificado, pero el lote no está disponible",
        409,
        "ADVANCE_PAYMENT_NOT_AVAILABLE",
      );
    }

    if (input.payments.length > 0) {
      throw new AppError(
        "La orden ya fue pagada anticipadamente; no debes enviar pagos nuevos",
        409,
        "ORDER_ALREADY_PAID",
      );
    }

    if (
      input.cashSessionId !== undefined &&
      input.cashSessionId !== advancePayment.cashSessionId
    ) {
      throw new AppError(
        "El pago anticipado pertenece a otro turno de caja",
        409,
        "ADVANCE_PAYMENT_CASH_SESSION_MISMATCH",
      );
    }

    const resolvedPayments: ResolvedSalePayment[] = advancePayment.payments.map(
      (payment) => ({
        orderPaymentId: payment.id,
        existingCashMovementId: payment.cashMovementId,
        processedByMembershipId: payment.processedByMembershipId,
        paymentMethodId: payment.paymentMethodId,
        paymentMethodCode: payment.paymentMethodCode,
        paymentMethodName: payment.paymentMethodName,
        paymentType: payment.paymentType,
        requiresReference: payment.requiresReference,
        affectsCash: payment.affectsCash,
        allowsChange: payment.allowsChange,
        amount: payment.amount,
        tenderedAmount: payment.tenderedAmount,
        changeAmount: payment.changeAmount,
        reference: payment.reference,
        notes: payment.notes,
      }),
    );

    data = {
      orderId: input.orderId,
      cashSessionId: advancePayment.cashSessionId,
      commercialCustomerId: order.commercialCustomerId,
      soldByMembershipId: membershipId,
      advancePaymentBatchId: advancePayment.id,
      paidTotal: advancePayment.paidTotal,
      changeTotal: advancePayment.changeTotal,
      payments: resolvedPayments,
    };
  } else {
    if (!input.cashSessionId) {
      throw new AppError(
        "Debes seleccionar un turno de caja",
        400,
        "CASH_SESSION_REQUIRED",
      );
    }

    if (input.payments.length === 0) {
      throw new AppError(
        "Debes registrar al menos una forma de pago",
        400,
        "SALE_PAYMENTS_REQUIRED",
      );
    }

    const resolvedInputs = await Promise.all(
      input.payments.map(async (payment) => {
        const paymentMethod = await findPaymentMethodById(
          businessId,
          payment.paymentMethodId,
        );

        if (!paymentMethod) {
          throw new AppError(
            "Una de las formas de pago no existe",
            404,
            "PAYMENT_METHOD_NOT_FOUND",
          );
        }

        if (!paymentMethod.isActive) {
          throw new AppError(
            `La forma de pago ${paymentMethod.name} está inactiva`,
            409,
            "PAYMENT_METHOD_INACTIVE",
          );
        }

        if (paymentMethod.requiresReference && !payment.reference) {
          throw new AppError(
            `La forma de pago ${paymentMethod.name} requiere una referencia`,
            400,
            "PAYMENT_REFERENCE_REQUIRED",
          );
        }

        return {
          input: payment,
          paymentMethod,
        };
      }),
    );

    const settlement = calculateSaleSettlement(
      order.total,
      resolvedInputs.map(({ input: payment, paymentMethod }) => ({
        amount: payment.amount,
        tenderedAmount: payment.tenderedAmount ?? payment.amount,
        allowsChange: paymentMethod.allowsChange,
      })),
    );

    const resolvedPayments: ResolvedSalePayment[] = resolvedInputs.map(
      ({ input: payment, paymentMethod }, index) => {
        const calculatedPayment = settlement.payments[index];

        if (!calculatedPayment) {
          throw new Error("No fue posible calcular uno de los pagos");
        }

        return {
          orderPaymentId: null,
          existingCashMovementId: null,
          processedByMembershipId: membershipId,
          paymentMethodId: paymentMethod.id,
          paymentMethodCode: paymentMethod.code,
          paymentMethodName: paymentMethod.name,
          paymentType: paymentMethod.paymentType,
          requiresReference: paymentMethod.requiresReference,
          affectsCash: paymentMethod.affectsCash,
          allowsChange: paymentMethod.allowsChange,
          amount: calculatedPayment.amount,
          tenderedAmount: calculatedPayment.tenderedAmount,
          changeAmount: calculatedPayment.changeAmount,
          reference: payment.reference,
          notes: payment.notes,
        };
      },
    );

    data = {
      orderId: input.orderId,
      cashSessionId: input.cashSessionId,
      commercialCustomerId: order.commercialCustomerId,
      soldByMembershipId: membershipId,
      advancePaymentBatchId: null,
      paidTotal: settlement.paidTotal,
      changeTotal: settlement.changeTotal,
      payments: resolvedPayments,
    };
  }

  const result = await createSaleRecord(businessId, data);

  switch (result.kind) {
    case "CREATED": {
      const sale = await findSaleById(businessId, result.saleId);

      if (!sale) {
        throw new Error("No fue posible recuperar la venta creada");
      }

      return sale;
    }

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_DELIVERED":
      throw new AppError(
        "La venta solamente puede cerrarse cuando la orden está entregada",
        409,
        "ORDER_NOT_DELIVERED",
      );

    case "SALE_ALREADY_EXISTS":
      throw new AppError(
        `La orden ya fue convertida en la venta ${result.saleId}`,
        409,
        "SALE_ALREADY_EXISTS",
      );

    case "ADVANCE_PAYMENT_NOT_AVAILABLE":
      throw new AppError(
        "El pago anticipado ya no está disponible para crear la venta",
        409,
        "ADVANCE_PAYMENT_NOT_AVAILABLE",
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
        "La caja y la orden pertenecen a ubicaciones diferentes",
        409,
        "CASH_SESSION_LOCATION_MISMATCH",
      );

    case "CUSTOMER_NOT_FOUND":
      throw new AppError(
        "El cliente comercial no existe",
        404,
        "COMMERCIAL_CUSTOMER_NOT_FOUND",
      );

    case "CUSTOMER_NOT_ACTIVE":
      throw new AppError(
        "El cliente comercial está inactivo",
        409,
        "COMMERCIAL_CUSTOMER_INACTIVE",
      );

    case "PAYMENT_METHOD_NOT_AVAILABLE":
      throw new AppError(
        `La forma de pago ${result.paymentMethodId} dejó de estar disponible`,
        409,
        "PAYMENT_METHOD_NOT_AVAILABLE",
      );

    case "SALE_TOTAL_CHANGED":
      throw new AppError(
        `El total de la orden cambió de ${result.receivedTotal} a ${result.expectedTotal}`,
        409,
        "SALE_TOTAL_CHANGED",
      );
  }
};

export { createSale };
