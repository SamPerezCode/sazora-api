import { AppError } from "../../../shared/errors/app-error";
import { createSaleRefundRecord } from "../repositories/create-sale-refund.repository";
import { findSaleById } from "../repositories/get-sale.repository";
import type { CreateSaleRefundInput } from "../schemas/sale-refund.schema";
import type { Sale } from "../sale.types";
import type { CreateSaleRefundData } from "../sale-refund.types";

interface CreateSaleRefundResponse {
  refundId: string;
  sale: Sale;
}

const createSaleRefund = async (
  businessId: string,
  membershipId: string,
  saleId: string,
  input: CreateSaleRefundInput,
): Promise<CreateSaleRefundResponse> => {
  const data: CreateSaleRefundData = {
    cashSessionId: input.cashSessionId,
    processedByMembershipId: membershipId,
    reason: input.reason,
    items: input.items,
    payments: input.payments,
  };

  const result = await createSaleRefundRecord(businessId, saleId, data);

  switch (result.kind) {
    case "CREATED": {
      const sale = await findSaleById(businessId, saleId);

      if (!sale) {
        throw new Error("No fue posible recuperar la venta actualizada");
      }

      return {
        refundId: result.refundId,
        sale,
      };
    }

    case "SALE_NOT_FOUND":
      throw new AppError("La venta no existe", 404, "SALE_NOT_FOUND");

    case "SALE_NOT_REFUNDABLE":
      throw new AppError(
        `La venta no puede devolverse porque su estado es ${result.status}`,
        409,
        "SALE_NOT_REFUNDABLE",
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
        "El turno de caja y la venta pertenecen a ubicaciones diferentes",
        409,
        "CASH_SESSION_LOCATION_MISMATCH",
      );

    case "SALE_ITEM_NOT_FOUND":
      throw new AppError(
        `El artículo de venta ${result.saleItemId} no existe`,
        404,
        "SALE_ITEM_NOT_FOUND",
      );

    case "REFUND_QUANTITY_EXCEEDED":
      throw new AppError(
        `Solo quedan ${result.availableQuantity} unidades disponibles ` +
          `del artículo ${result.saleItemId}`,
        409,
        "REFUND_QUANTITY_EXCEEDED",
      );

    case "SALE_PAYMENT_NOT_FOUND":
      throw new AppError(
        `El pago ${result.salePaymentId} no pertenece a la venta`,
        404,
        "SALE_PAYMENT_NOT_FOUND",
      );

    case "REFUND_PAYMENT_EXCEEDED":
      throw new AppError(
        `El pago ${result.salePaymentId} solo tiene ` +
          `${result.availableAmount} disponibles`,
        409,
        "REFUND_PAYMENT_EXCEEDED",
      );

    case "PAYMENT_REFERENCE_REQUIRED":
      throw new AppError(
        `El reembolso del pago ${result.salePaymentId} requiere referencia`,
        400,
        "PAYMENT_REFERENCE_REQUIRED",
      );

    case "REFUND_TOTAL_MISMATCH":
      throw new AppError(
        `El reembolso debe sumar ${result.expectedTotal}, ` +
          `pero se recibieron ${result.receivedTotal}`,
        409,
        "REFUND_TOTAL_MISMATCH",
      );

    case "INSUFFICIENT_CASH":
      throw new AppError(
        `La caja tiene ${result.expectedCashAmount} disponibles y ` +
          `el reembolso requiere ${result.requiredCashAmount}`,
        409,
        "INSUFFICIENT_CASH_FOR_REFUND",
      );
  }
};

export { createSaleRefund };
