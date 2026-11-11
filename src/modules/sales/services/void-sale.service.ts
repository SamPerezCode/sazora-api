import { AppError } from "../../../shared/errors/app-error";
import { findSaleById } from "../repositories/get-sale.repository";
import { voidSaleRecord } from "../repositories/void-sale.repository";
import type { VoidSaleInput } from "../schemas/void-sale.schema";
import type { Sale } from "../sale.types";

const voidSale = async (
  businessId: string,
  membershipId: string,
  saleId: string,
  input: VoidSaleInput,
): Promise<Sale> => {
  const result = await voidSaleRecord(
    businessId,
    membershipId,
    saleId,
    input.cashSessionId,
    input.reason,
  );

  switch (result.kind) {
    case "VOIDED": {
      const sale = await findSaleById(businessId, saleId);

      if (!sale) {
        throw new Error("No fue posible recuperar la venta anulada");
      }

      return sale;
    }

    case "SALE_NOT_FOUND":
      throw new AppError("La venta no existe", 404, "SALE_NOT_FOUND");

    case "SALE_NOT_VOIDABLE":
      throw new AppError(
        `La venta no puede anularse porque su estado es ${result.status}`,
        409,
        "SALE_NOT_VOIDABLE",
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

    case "INSUFFICIENT_CASH":
      throw new AppError(
        `La caja tiene ${result.expectedCashAmount} disponibles y ` +
          `la anulación requiere ${result.requiredCashAmount}`,
        409,
        "INSUFFICIENT_CASH_FOR_VOID",
      );
  }
};

export { voidSale };
