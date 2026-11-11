import { findSaleRefunds } from "../repositories/get-sale-refund.repository";
import type { SaleRefund } from "../sale-refund.types";

const getSaleRefunds = async (
  businessId: string,
  saleId: string,
): Promise<SaleRefund[]> => findSaleRefunds(businessId, saleId);

export { getSaleRefunds };
