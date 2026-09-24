import { AppError } from "../../../shared/errors/app-error";
import {
  removeCatalogImage,
  storeCatalogImage,
} from "../../../shared/images/catalog-image.storage";
import { findCategoryById } from "../../categories/repositories/category.repository";
import { findPreparationAreaById } from "../../preparation-areas/repositories/preparation-area.repository";
import { updateComboProductRecord } from "../repositories/update-combo-product.repository";
import type { UpdateComboProductInput } from "../schemas/update-combo-product.schema";
import {
  getComboProduct,
  type ComboProductDetail,
} from "./get-combo-product.service";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const updateComboProduct = async (
  businessId: string,
  comboProductId: string,
  input: UpdateComboProductInput,
  imageBuffer: Buffer | undefined,
): Promise<ComboProductDetail> => {
  const currentCombo = await getComboProduct(businessId, comboProductId);

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

  let newImageUrl: string | undefined;
  let updateCompleted = false;

  try {
    if (imageBuffer) {
      newImageUrl = await storeCatalogImage(imageBuffer);
    }

    const result = await updateComboProductRecord(
      businessId,
      comboProductId,
      input,
      newImageUrl,
    );

    switch (result.kind) {
      case "UPDATED":
        updateCompleted = true;
        break;

      case "COMBO_NOT_FOUND":
        throw new AppError(
          "El producto combo no existe",
          404,
          "COMBO_PRODUCT_NOT_FOUND",
        );

      case "SELF_REFERENCE":
        throw new AppError(
          "Un combo no puede contenerse a sí mismo",
          409,
          "COMBO_SELF_REFERENCE",
        );

      case "COMPONENTS_NOT_AVAILABLE":
        throw new AppError(
          `Los siguientes productos no existen o están inactivos: ${result.productIds.join(", ")}`,
          409,
          "COMBO_COMPONENTS_NOT_AVAILABLE",
        );

      case "COMPONENT_WITHOUT_INVENTORY":
        throw new AppError(
          `El producto ${result.productId} no tiene inventario configurado`,
          409,
          "COMBO_COMPONENT_WITHOUT_INVENTORY",
        );
    }

    const updatedCombo = await getComboProduct(businessId, comboProductId);

    if (newImageUrl) {
      try {
        await removeCatalogImage(currentCombo.product.imageUrl);
      } catch (cleanupError) {
        console.error(
          "No fue posible eliminar la imagen anterior del combo",
          cleanupError,
        );
      }
    }

    return updatedCombo;
  } catch (error) {
    if (newImageUrl && !updateCompleted) {
      try {
        await removeCatalogImage(newImageUrl);
      } catch (cleanupError) {
        console.error(
          "No fue posible eliminar la nueva imagen del combo fallido",
          cleanupError,
        );
      }
    }

    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe un producto o combo con ese SKU",
        409,
        "PRODUCT_SKU_CONFLICT",
      );
    }

    throw error;
  }
};

export { updateComboProduct };
