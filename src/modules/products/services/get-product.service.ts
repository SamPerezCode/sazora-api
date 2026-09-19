import { AppError } from "../../../shared/errors/app-error";
import type { ProductListItem } from "../product.types";
import { findProductDetailById } from "../repositories/product.repository";

const getProduct = async (
  businessId: string,
  productId: string,
): Promise<ProductListItem> => {
  const product = await findProductDetailById(businessId, productId);

  if (!product) {
    throw new AppError("El producto no existe", 404, "PRODUCT_NOT_FOUND");
  }

  return product;
};

export { getProduct };
