type ProductInventoryLink = Readonly<{
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemType: string;
  baseUnit: string;
  quantityPerProduct: string;
  autoDeduct: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type CreateProductInventoryLinkData = Readonly<{
  productId: string;
  inventoryItemId: string;
  quantityPerProduct: string;
  autoDeduct: boolean;
}>;

type UpdateProductInventoryLinkData = Readonly<{
  quantityPerProduct?: string | undefined;
  autoDeduct?: boolean | undefined;
}>;

export type {
  CreateProductInventoryLinkData,
  ProductInventoryLink,
  UpdateProductInventoryLinkData,
};
