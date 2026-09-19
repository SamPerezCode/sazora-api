import { AppError } from "../../../shared/errors/app-error";
import type { Category } from "../category.types";
import { createCategory as createCategoryRecord } from "../repositories/category.repository";
import type { CreateCategoryInput } from "../schemas/create-category.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const createCategory = async (
  businessId: string,
  input: CreateCategoryInput,
): Promise<Category> => {
  try {
    return await createCategoryRecord(businessId, input);
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una categoría con ese nombre",
        409,
        "CATEGORY_NAME_CONFLICT",
      );
    }

    throw error;
  }
};

export { createCategory };
