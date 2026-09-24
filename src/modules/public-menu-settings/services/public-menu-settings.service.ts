import { findCategoryById } from "../../categories/repositories/category.repository";
import { findProductById } from "../../products/repositories/product.repository";
import { AppError } from "../../../shared/errors/app-error";
import type {
  PublicMenuSettingsCatalog,
  PublicMenuSettingsCategory,
  PublicMenuSettingsProduct,
} from "../public-menu-settings.types";
import {
  findPublicMenuSettingsCatalog,
  updateCategoryPublicVisibility,
  updateProductPublicSettings,
} from "../repositories/public-menu-settings.repository";

const getPublicMenuSettingsCatalog = async (
  businessId: string,
): Promise<PublicMenuSettingsCatalog> =>
  findPublicMenuSettingsCatalog(businessId);

const changeCategoryPublicVisibility = async (
  businessId: string,
  categoryId: string,
  isPubliclyVisible: boolean,
): Promise<PublicMenuSettingsCategory> => {
  const existingCategory = await findCategoryById(businessId, categoryId);

  if (!existingCategory) {
    throw new AppError("La categoría no existe", 404, "CATEGORY_NOT_FOUND");
  }

  await updateCategoryPublicVisibility(
    businessId,
    categoryId,
    isPubliclyVisible,
  );

  const catalog = await findPublicMenuSettingsCatalog(businessId);

  const category = catalog.categories.find((item) => item.id === categoryId);

  if (!category) {
    throw new Error(
      "No fue posible recuperar la configuración de la categoría",
    );
  }

  return category;
};

const changeProductPublicSettings = async (
  businessId: string,
  productId: string,
  isPubliclyVisible: boolean,
  isPubliclyOrderable: boolean,
): Promise<PublicMenuSettingsProduct> => {
  const existingProduct = await findProductById(businessId, productId);

  if (!existingProduct) {
    throw new AppError("El producto no existe", 404, "PRODUCT_NOT_FOUND");
  }

  await updateProductPublicSettings(
    businessId,
    productId,
    isPubliclyVisible,
    isPubliclyOrderable,
  );

  const catalog = await findPublicMenuSettingsCatalog(businessId);

  const product = catalog.categories
    .flatMap((category) => category.products)
    .find((item) => item.id === productId);

  if (!product) {
    throw new Error("No fue posible recuperar la configuración del producto");
  }

  return product;
};

export {
  changeCategoryPublicVisibility,
  changeProductPublicSettings,
  getPublicMenuSettingsCatalog,
};
