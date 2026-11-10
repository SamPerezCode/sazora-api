import { AppError } from "../../../shared/errors/app-error";
import { findSaleById } from "../repositories/get-sale.repository";
import type { Sale } from "../sale.types";

const getSale = async (businessId: string, saleId: string): Promise<Sale> => {
  const sale = await findSaleById(businessId, saleId);

  if (!sale) {
    throw new AppError("La venta no existe", 404, "SALE_NOT_FOUND");
  }

  return sale;
};

export { getSale };
