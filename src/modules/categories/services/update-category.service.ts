import { AppError } from "../../../shared/errors/app-error";
import type { Category, UpdateCategoryData } from "../category.types";
import {
  findCategoryById,
  updateCategory as updateCategoryRecord,
} from "../repositories/category.repository";
import type { UpdateCategoryInput } from "../schemas/update-category.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const updateCategory = async (
  businessId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<Category> => {
  const currentCategory = await findCategoryById(businessId, categoryId);

  if (!currentCategory) {
    throw new AppError("La categoría no existe", 404, "CATEGORY_NOT_FOUND");
  }

  const data: UpdateCategoryData = {
    name: input.name ?? currentCategory.name,
    description:
      input.description === undefined
        ? currentCategory.description
        : input.description,
    displayOrder: input.displayOrder ?? currentCategory.displayOrder,
  };

  try {
    return await updateCategoryRecord(businessId, categoryId, data);
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

export { updateCategory };
