type InventoryItemType =
  "RAW_MATERIAL" | "SEMI_FINISHED" | "FINISHED_GOOD" | "RESALE_GOOD";

type InventoryUnit =
  "UNIT" | "GRAM" | "KILOGRAM" | "MILLILITER" | "LITER" | "PORTION" | "PACKAGE";

type InventoryStockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "AVAILABLE";

type InventoryItem = Readonly<{
  id: string;
  businessId: string;
  sku: string | null;
  name: string;
  itemType: InventoryItemType;
  baseUnit: InventoryUnit;
  currentStock: string;
  minimumStock: string;
  stockStatus: InventoryStockStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type ProductionInventoryItemCatalogEntry = Readonly<{
  id: string;
  businessId: string;
  name: string;
  sku: string | null;
  baseUnit: InventoryUnit;
  isActive: boolean;
}>;

type CreateInventoryItemData = Readonly<{
  sku: string | null;
  name: string;
  itemType: InventoryItemType;
  baseUnit: InventoryUnit;

  locationId: string;
  openingQuantity: string;
  openingUnitCost: string | null;
  minimumStock: string;
}>;

type UpdateInventoryItemData = Readonly<{
  sku?: string | null | undefined;
  name?: string | undefined;
  itemType?: InventoryItemType | undefined;
  baseUnit?: InventoryUnit | undefined;

  /*
   * locationId y minimumStock deben enviarse juntos.
   */
  locationId?: string | undefined;
  minimumStock?: string | undefined;
}>;

export type {
  CreateInventoryItemData,
  InventoryItem,
  InventoryItemType,
  InventoryStockStatus,
  InventoryUnit,
  ProductionInventoryItemCatalogEntry,
  UpdateInventoryItemData,
};
