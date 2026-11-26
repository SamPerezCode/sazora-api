import type { ProductInventoryLink } from "../product-inventory-link.types";
import { saveProductInventoryCompositionRecord } from "../repositories/product-inventory-composition.repository";
import type { SaveProductInventoryCompositionInput } from "../schemas/product-inventory-composition.schema";

const saveProductInventoryComposition = async (
  businessId: string,
  productId: string,
  input: SaveProductInventoryCompositionInput,
): Promise<ProductInventoryLink[]> =>
  saveProductInventoryCompositionRecord(businessId, productId, input);

export { saveProductInventoryComposition };
