import { AppError } from "../../../shared/errors/app-error";
import { findCategoryById } from "../../categories/repositories/category.repository";
import { findPreparationAreaById } from "../../preparation-areas/repositories/preparation-area.repository";
import type { Product } from "../product.types";
import { createProduct as createProductRecord } from "../repositories/product.repository";
import type { CreateProductInput } from "../schemas/create-product.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const createProduct = async (
  businessId: string,
  input: CreateProductInput,
): Promise<Product> => {
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

  try {
    return await createProductRecord(businessId, input);
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

export { createProduct };
