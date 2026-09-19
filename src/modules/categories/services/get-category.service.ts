import { AppError } from "../../../shared/errors/app-error";
import type { Category } from "../category.types";
import { findCategoryById } from "../repositories/category.repository";

const getCategory = async (
  businessId: string,
  categoryId: string,
): Promise<Category> => {
  const category = await findCategoryById(businessId, categoryId);

  if (!category) {
    throw new AppError("La categoría no existe", 404, "CATEGORY_NOT_FOUND");
  }

  return category;
};

export { getCategory };
