import { AppError } from "../../../shared/errors/app-error";
import { removeCatalogImage } from "../../../shared/images/catalog-image.storage";
import type { Category } from "../category.types";
import {
  findCategoryById,
  updateCategoryImage,
} from "../repositories/category.repository";

const removeCategoryImageReference = async (
  businessId: string,
  categoryId: string,
): Promise<Category> => {
  const currentCategory = await findCategoryById(businessId, categoryId);

  if (!currentCategory) {
    throw new AppError("La categoría no existe", 404, "CATEGORY_NOT_FOUND");
  }

  if (!currentCategory.imageUrl) {
    return currentCategory;
  }

  const category = await updateCategoryImage(businessId, categoryId, null);

  try {
    await removeCatalogImage(currentCategory.imageUrl);
  } catch (error) {
    console.error(
      "No fue posible eliminar la imagen anterior de la categoría",
      error,
    );
  }

  return category;
};

export { removeCategoryImageReference };
