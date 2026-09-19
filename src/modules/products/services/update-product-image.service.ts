import { AppError } from "../../../shared/errors/app-error";
import {
  removeCatalogImage,
  storeCatalogImage,
} from "../../../shared/images/catalog-image.storage";
import type { Product } from "../product.types";
import {
  findProductById,
  updateProductImage,
} from "../repositories/product.repository";

const replaceProductImage = async (
  businessId: string,
  productId: string,
  imageBuffer: Buffer,
): Promise<Product> => {
  const currentProduct = await findProductById(businessId, productId);

  if (!currentProduct) {
    throw new AppError("El producto no existe", 404, "PRODUCT_NOT_FOUND");
  }

  const newImageUrl = await storeCatalogImage(imageBuffer);

  let product: Product;

  try {
    product = await updateProductImage(businessId, productId, newImageUrl);
  } catch (error) {
    await removeCatalogImage(newImageUrl);
    throw error;
  }

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

export { replaceProductImage };
