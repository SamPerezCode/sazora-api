type ProductFulfillmentMode = "PREPARE_TO_ORDER" | "READY_TO_SERVE";

type Product = Readonly<{
  id: string;
  businessId: string;
  categoryId: string;
  preparationAreaId: string;
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
  }>;

type CreateProductData = Readonly<{
  categoryId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  currentPrice: string;
}>;

type UpdateProductData = Readonly<{
  categoryId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  sku: string | null;
  name: string;
  description: string | null;
  currentPrice: string;
}>;

export type {
  CreateProductData,
  Product,
  ProductFulfillmentMode,
  ProductListItem,
  UpdateProductData,
};
