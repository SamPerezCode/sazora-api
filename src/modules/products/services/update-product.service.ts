import { AppError } from "../../../shared/errors/app-error";
import { findCategoryById } from "../../categories/repositories/category.repository";
import { findPreparationAreaById } from "../../preparation-areas/repositories/preparation-area.repository";
import type { Product, UpdateProductData } from "../product.types";
import {
  findProductById,
  updateProduct as updateProductRecord,
} from "../repositories/product.repository";
import type { UpdateProductInput } from "../schemas/update-product.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const updateProduct = async (
  businessId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<Product> => {
  const currentProduct = await findProductById(businessId, productId);

  if (!currentProduct) {
    throw new AppError("El producto no existe", 404, "PRODUCT_NOT_FOUND");
  }

  if (input.categoryId !== undefined) {
    const category = await findCategoryById(businessId, input.categoryId);

    if (!category) {
      throw new AppError("La categoría no existe", 404, "CATEGORY_NOT_FOUND");
    }

    if (!category.isActive) {
      throw new AppError(
        "La categoría está desactivada",
        409,
        "CATEGORY_INACTIVE",
      );
    }
  }

  if (input.preparationAreaId !== undefined) {
    const preparationArea = await findPreparationAreaById(
      businessId,
      input.preparationAreaId,
    );

    if (!preparationArea) {
      throw new AppError(
        "El área de preparación no existe",
        404,
        "PREPARATION_AREA_NOT_FOUND",
      );
    }

    if (!preparationArea.isActive) {
      throw new AppError(
        "El área de preparación está desactivada",
        409,
        "PREPARATION_AREA_INACTIVE",
      );
    }
  }

  const data: UpdateProductData = {
    categoryId: input.categoryId ?? currentProduct.categoryId,
    preparationAreaId:
      input.preparationAreaId ?? currentProduct.preparationAreaId,
    sku: input.sku !== undefined ? input.sku : currentProduct.sku,
    name: input.name ?? currentProduct.name,
    description:
      input.description !== undefined
        ? input.description
        : currentProduct.description,
    currentPrice: input.currentPrice ?? currentProduct.currentPrice,
  };

  try {
    return await updateProductRecord(businessId, productId, data);
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe un producto con ese SKU",
        409,
        "PRODUCT_SKU_CONFLICT",
      );
    }

    throw error;
  }
};

export { updateProduct };
