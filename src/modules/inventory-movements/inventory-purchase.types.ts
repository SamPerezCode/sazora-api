import type { InventoryUnit } from "../inventory-items/inventory-item.types";

type InventoryPurchasePresentation = Readonly<{
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: InventoryUnit;
  name: string;
  conversionFactor: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type CreateInventoryPurchasePresentationData = Readonly<{
  name: string;
  conversionFactor: string;
}>;

type NewInventoryPurchaseLine = Readonly<{
  inventoryItemId: string;
  presentationId: string;
  purchasedQuantity: string;
  totalCost: string;
  notes: string | null;
}>;

type CreateInventoryPurchaseData = Readonly<{
  locationId: string;
  externalReference: string | null;
  notes: string | null;
  lines: readonly NewInventoryPurchaseLine[];
}>;

type InventoryPurchaseLine = Readonly<{
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: InventoryUnit;

  presentation: Readonly<{
    id: string;
    name: string;
    conversionFactor: string;
  }>;

  purchasedQuantity: string;
  baseQuantity: string;

  unitCost: string;
  totalCost: string;

  balanceBefore: string;
  balanceAfter: string;

  averageUnitCostBefore: string | null;
  averageUnitCostAfter: string;

  inventoryValueBefore: string | null;
  inventoryValueAfter: string;

  notes: string | null;
}>;

type InventoryPurchase = Readonly<{
  id: string;
  businessId: string;

  location: Readonly<{
    id: string;
    code: string;
    name: string;
  }>;

  externalReference: string | null;
  notes: string | null;

  totalCost: string;

  createdByMembershipId: string;
  createdByName: string;
  createdAt: Date;

  lines: readonly InventoryPurchaseLine[];
}>;

type CreateInventoryPurchaseResult =
  | Readonly<{
      kind: "CREATED";
      purchase: InventoryPurchase;
    }>
  | Readonly<{
      kind: "LOCATION_NOT_FOUND";
    }>
  | Readonly<{
      kind: "LOCATION_INACTIVE";
    }>
  | Readonly<{
      kind: "LOCATION_NOT_INVENTORY_ENABLED";
    }>
  | Readonly<{
      kind: "PRESENTATIONS_NOT_AVAILABLE";
      presentationIds: readonly string[];
    }>
  | Readonly<{
      kind: "PRESENTATION_ITEM_MISMATCH";
      presentationId: string;
      inventoryItemId: string;
    }>
  | Readonly<{
      kind: "UNVALUED_STOCK";
      inventoryItemId: string;
    }>
  | Readonly<{
      kind: "NEGATIVE_STOCK";
      inventoryItemId: string;
      currentStock: string;
    }>
  | Readonly<{
      kind: "BASE_QUANTITY_TOO_SMALL";
      inventoryItemId: string;
    }>;

export type {
  CreateInventoryPurchaseData,
  CreateInventoryPurchasePresentationData,
  CreateInventoryPurchaseResult,
  InventoryPurchase,
  InventoryPurchaseLine,
  InventoryPurchasePresentation,
  NewInventoryPurchaseLine,
};
