import type { ProductListItem } from "../product.types";
import { findProductsByBusinessId } from "../repositories/product.repository";

const listProducts = async (businessId: string): Promise<ProductListItem[]> => {
  return findProductsByBusinessId(businessId);
};

export { listProducts };
