import { AppError } from "../../../shared/errors/app-error";
import type { ProductInventoryLink } from "../../product-inventory-links/product-inventory-link.types";
import { findProductInventoryLinks } from "../../product-inventory-links/repositories/product-inventory-link.repository";
import type { Product } from "../product.types";
import {
  findComboComponents,
  type ComboComponent,
} from "../repositories/combo-product-detail.repository";
import { findProductById } from "../repositories/product.repository";

type ComboProductDetail = Readonly<{
  product: Product;
  components: readonly ComboComponent[];
  inventoryLinks: readonly ProductInventoryLink[];
}>;

const getComboProduct = async (
  businessId: string,
  comboProductId: string,
): Promise<ComboProductDetail> => {
  const [product, components, businessLinks] = await Promise.all([
    findProductById(businessId, comboProductId),

    findComboComponents(businessId, comboProductId),

    findProductInventoryLinks(businessId),
  ]);

  if (!product || components.length === 0) {
    throw new AppError(
      "El producto combo no existe",
      404,
      "COMBO_PRODUCT_NOT_FOUND",
    );
  }

  const inventoryLinks = businessLinks.filter(
    (link) => link.productId === comboProductId,
  );

  return {
    product,
    components,
    inventoryLinks,
  };
};

export { getComboProduct };
export type { ComboProductDetail };
