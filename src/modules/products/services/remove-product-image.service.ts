import { AppError } from "../../../shared/errors/app-error";
import { removeCatalogImage } from "../../../shared/images/catalog-image.storage";
import type { Product } from "../product.types";
import {
  findProductById,
  updateProductImage,
} from "../repositories/product.repository";

const removeProductImageReference = async (
  businessId: string,
  productId: string,
): Promise<Product> => {
  const currentProduct = await findProductById(businessId, productId);

  if (!currentProduct) {
    throw new AppError("El producto no existe", 404, "PRODUCT_NOT_FOUND");
  }

  if (!currentProduct.imageUrl) {
    return currentProduct;
  }

  const product = await updateProductImage(businessId, productId, null);

  try {
    await removeCatalogImage(currentProduct.imageUrl);
  } catch (error) {
    console.error(
      "No fue posible eliminar la imagen anterior del producto",
      error,
    );
  }

  return product;
};

export { removeProductImageReference };
