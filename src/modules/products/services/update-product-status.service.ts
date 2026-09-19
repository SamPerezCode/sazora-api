import { AppError } from "../../../shared/errors/app-error";
import type { Product } from "../product.types";
import {
  findProductById,
  updateProductStatus,
} from "../repositories/product.repository";
import type { UpdateProductStatusInput } from "../schemas/update-product-status.schema";

const changeProductStatus = async (
  businessId: string,
  productId: string,
  input: UpdateProductStatusInput,
): Promise<Product> => {
  const product = await findProductById(businessId, productId);

  if (!product) {
    throw new AppError("El producto no existe", 404, "PRODUCT_NOT_FOUND");
  }

  if (product.isActive === input.isActive) {
    return product;
  }

  return updateProductStatus(businessId, productId, input.isActive);
};

export { changeProductStatus };
