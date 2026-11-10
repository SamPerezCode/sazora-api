type ProductFulfillmentMode = "PREPARE_TO_ORDER" | "READY_TO_SERVE";

type ProductInventoryTrackingType =
  "NONE" | "RESALE" | "PRODUCTION" | "COMBO" | "CUSTOM";

type Product = Readonly<{
  id: string;
  businessId: string;
  categoryId: string;
  preparationAreaId: string;
  taxClassId: string | null;
  priceIncludesTax: boolean;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type ProductListItem = Product &
  Readonly<{
    categoryName: string;
    categoryIsActive: boolean;
    preparationAreaName: string;
    preparationAreaIsActive: boolean;
    isAvailable: boolean;
    isCombo: boolean;
    hasInventory: boolean;
    canBeComboComponent: boolean;
    inventoryTrackingType: ProductInventoryTrackingType;
  }>;

type CreateProductData = Readonly<{
  categoryId: string;
  preparationAreaId: string;
  taxClassId: string | null;
  priceIncludesTax: boolean;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  currentPrice: string;
}>;

type UpdateProductData = Readonly<{
  categoryId: string;
  preparationAreaId: string;
  taxClassId: string | null;
  priceIncludesTax: boolean;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  currentPrice: string;
}>;

type ProductAvailabilityReason = "PRODUCT_INACTIVE" | "OUT_OF_STOCK" | null;

type ProductCommercialAvailability = Readonly<{
  productId: string;
  locationId: string;
  productName: string;
  currentPrice: string;
  isInventoryTracked: boolean;
  maxOrderQuantity: number | null;
  isAvailable: boolean;
  unavailableReason: ProductAvailabilityReason;
}>;

export type {
  CreateProductData,
  Product,
  ProductCommercialAvailability,
  ProductAvailabilityReason,
  ProductFulfillmentMode,
  ProductInventoryTrackingType,
  ProductListItem,
  UpdateProductData,
};
