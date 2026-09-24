import { AppError } from "../../../shared/errors/app-error";
import {
  removeCatalogImage,
  storeCatalogImage,
} from "../../../shared/images/catalog-image.storage";
import { findCategoryById } from "../../categories/repositories/category.repository";
import { findPreparationAreaById } from "../../preparation-areas/repositories/preparation-area.repository";
import type { ProductInventoryLink } from "../../product-inventory-links/product-inventory-link.types";
import { findProductInventoryLinkById } from "../../product-inventory-links/repositories/product-inventory-link.repository";
import type { Product } from "../product.types";
import { createComboProductRecord } from "../repositories/combo-product.repository";
import { findProductById } from "../repositories/product.repository";
import type { CreateComboProductInput } from "../schemas/create-combo-product.schema";

type CreatedComboProduct = Readonly<{
  product: Product;
  components: CreateComboProductInput["components"];
  inventoryLinks: readonly ProductInventoryLink[];
}>;

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const createComboProduct = async (
  businessId: string,
  input: CreateComboProductInput,
  imageBuffer: Buffer | undefined,
): Promise<CreatedComboProduct> => {
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

  let imageUrl: string | null = null;
  let productWasCreated = false;

  try {
    if (imageBuffer) {
      imageUrl = await storeCatalogImage(imageBuffer);
    }

    const result = await createComboProductRecord(businessId, input, imageUrl);

    if (result.kind === "COMPONENTS_NOT_AVAILABLE") {
      throw new AppError(
        `Los siguientes productos no existen o están inactivos: ${result.productIds.join(", ")}`,
        409,
        "COMBO_COMPONENTS_NOT_AVAILABLE",
      );
    }

    if (result.kind === "COMPONENT_WITHOUT_INVENTORY") {
      throw new AppError(
        `El producto ${result.productId} no tiene inventario configurado`,
        409,
        "COMBO_COMPONENT_WITHOUT_INVENTORY",
      );
    }

    productWasCreated = true;

    const product = await findProductById(businessId, result.comboProductId);

    if (!product) {
      throw new Error("No fue posible recuperar el combo creado");
    }

    const inventoryLinks: ProductInventoryLink[] = [];

    for (const linkId of result.productInventoryLinkIds) {
      const link = await findProductInventoryLinkById(businessId, linkId);

      if (!link) {
        throw new Error("No fue posible recuperar una relación del combo");
      }

      inventoryLinks.push(link);
    }

    return {
      product,
      components: input.components,
      inventoryLinks,
    };
  } catch (error) {
    if (imageUrl && !productWasCreated) {
      try {
        await removeCatalogImage(imageUrl);
      } catch (cleanupError) {
        console.error(
          "No fue posible eliminar la imagen del combo fallido",
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

export { createComboProduct };
export type { CreatedComboProduct };
