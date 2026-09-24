import { AppError } from "../../../shared/errors/app-error";
import type { InventoryItem } from "../../inventory-items/inventory-item.types";
import { findInventoryItemById } from "../../inventory-items/repositories/inventory-item.repository";
import type { Product } from "../../products/product.types";
import { findProductById } from "../../products/repositories/product.repository";
import type { ProductInventoryLink } from "../product-inventory-link.types";
import { findProductInventoryLinkById } from "../repositories/product-inventory-link.repository";
import { configureProductInventoryRecord } from "../repositories/configure-product-inventory.repository";
import type { ConfigureProductInventoryInput } from "../schemas/configure-product-inventory.schema";

type ProductInventorySetup = Readonly<{
  trackingType: "RESALE" | "PRODUCTION";
  product: Product;
  inventoryItem: InventoryItem;
  link: ProductInventoryLink;
}>;

const configureProductInventory = async (
  businessId: string,
  membershipId: string,
  productId: string,
  input: ConfigureProductInventoryInput,
): Promise<ProductInventorySetup> => {
  const result = await configureProductInventoryRecord(
    businessId,
    membershipId,
    productId,
    input,
  );

  if (result.kind === "PRODUCT_NOT_AVAILABLE") {
    throw new AppError(
      "El producto no existe o está inactivo",
      404,
      "PRODUCT_NOT_AVAILABLE",
    );
  }

  if (result.kind === "ALREADY_CONFIGURED") {
    throw new AppError(
      `El producto ya administra inventario mediante la relación ${result.productInventoryLinkId}`,
      409,
      "PRODUCT_INVENTORY_ALREADY_CONFIGURED",
    );
  }

  const [product, inventoryItem, link] = await Promise.all([
    findProductById(businessId, productId),

    findInventoryItemById(businessId, result.inventoryItemId),

    findProductInventoryLinkById(businessId, result.productInventoryLinkId),
  ]);

  if (!product || !inventoryItem || !link) {
    throw new Error(
      "No fue posible recuperar la configuración de inventario creada",
    );
  }

  return {
    trackingType: input.trackingType,
    product,
    inventoryItem,
    link,
  };
};

export { configureProductInventory };

export type { ProductInventorySetup };
