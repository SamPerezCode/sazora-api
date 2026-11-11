import { AppError } from "../../../shared/errors/app-error";
import { findSaleRefundById } from "../repositories/get-sale-refund.repository";
import type { SaleRefund } from "../sale-refund.types";

const getSaleRefund = async (
  businessId: string,
  saleId: string,
  refundId: string,
): Promise<SaleRefund> => {
  const refund = await findSaleRefundById(businessId, saleId, refundId);

  if (!refund) {
    throw new AppError("La devolución no existe", 404, "SALE_REFUND_NOT_FOUND");
  }

  return refund;
};

export { getSaleRefund };
