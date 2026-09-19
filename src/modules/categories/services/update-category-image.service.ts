import { AppError } from "../../../shared/errors/app-error";
import {
  removeCatalogImage,
  storeCatalogImage,
} from "../../../shared/images/catalog-image.storage";
import type { Category } from "../category.types";
import {
  findCategoryById,
  updateCategoryImage,
} from "../repositories/category.repository";

const replaceCategoryImage = async (
  businessId: string,
  categoryId: string,
  imageBuffer: Buffer,
): Promise<Category> => {
  const currentCategory = await findCategoryById(businessId, categoryId);

  if (!currentCategory) {
    throw new AppError("La categoría no existe", 404, "CATEGORY_NOT_FOUND");
  }

  const newImageUrl = await storeCatalogImage(imageBuffer);

  let category: Category;

  try {
    category = await updateCategoryImage(businessId, categoryId, newImageUrl);
  } catch (error) {
    await removeCatalogImage(newImageUrl);
    throw error;
  }

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

export { replaceCategoryImage };
