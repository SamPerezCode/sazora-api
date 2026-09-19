import { AppError } from "../../../shared/errors/app-error";
import type { Category } from "../category.types";
import {
  findCategoryById,
  updateCategoryStatus,
} from "../repositories/category.repository";
import type { UpdateCategoryStatusInput } from "../schemas/update-category-status.schema";

const changeCategoryStatus = async (
  businessId: string,
  categoryId: string,
  input: UpdateCategoryStatusInput,
): Promise<Category> => {
  const currentCategory = await findCategoryById(businessId, categoryId);

  if (!currentCategory) {
    throw new AppError("La categoría no existe", 404, "CATEGORY_NOT_FOUND");
  }

  if (currentCategory.isActive === input.isActive) {
    return currentCategory;
  }

  return updateCategoryStatus(businessId, categoryId, input.isActive);
};

export { changeCategoryStatus };
