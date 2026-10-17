import type {
  InventoryItemType,
  InventoryStockStatus,
  InventoryUnit,
} from "./inventory-item.types";

type InventoryValuationStatus = "UNVALUED" | "VALUED";

type InventoryLocationBalance = Readonly<{
  inventoryItemId: string;
  sku: string | null;
  name: string;
  itemType: InventoryItemType;
  baseUnit: InventoryUnit;
  isItemActive: boolean;

  location: Readonly<{
    id: string;
    code: string;
    name: string;
    locationType: "PRODUCTION_WAREHOUSE" | "POINT_OF_SALE";
    isActive: boolean;
  }>;

  currentStock: string;
  minimumStock: string;
  stockStatus: InventoryStockStatus;

  averageUnitCost: string | null;
  inventoryValue: string | null;
  valuationStatus: InventoryValuationStatus;

  migratedFromLegacy: boolean;

  createdAt: Date;
  updatedAt: Date;
}>;

type InventoryLocationBalanceScope =
  | Readonly<{
      type: "BUSINESS";
      location: null;
    }>
  | Readonly<{
      type: "LOCATION";
      location: Readonly<{
        id: string;
        code: string;
        name: string;
      }>;
    }>;

type InventoryLocationBalanceResult = Readonly<{
  scope: InventoryLocationBalanceScope;
  balances: readonly InventoryLocationBalance[];

  summary: Readonly<{
    itemCount: number;
    valuedItemCount: number;
    unvaluedItemCount: number;
    totalInventoryValue: string | null;
    hasUnvaluedStock: boolean;
  }>;
}>;

type InitialInventoryValuationData = Readonly<{
  unitCost: string;
  reason: string;
}>;

type InventoryValuationEvent = Readonly<{
  id: string;
  inventoryItemId: string;
  locationId: string;

  eventType: "INITIAL_VALUATION" | "COST_CORRECTION";

  quantitySnapshot: string;

  previousAverageUnitCost: string | null;
  newAverageUnitCost: string;

  previousInventoryValue: string | null;
  newInventoryValue: string;

  reason: string;

  createdByMembershipId: string;
  createdAt: Date;
}>;

export type {
  InitialInventoryValuationData,
  InventoryLocationBalance,
  InventoryLocationBalanceResult,
  InventoryLocationBalanceScope,
  InventoryValuationEvent,
  InventoryValuationStatus,
};
