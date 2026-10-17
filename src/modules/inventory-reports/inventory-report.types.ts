import type {
  InventoryItemType,
  InventoryUnit,
} from "../inventory-items/inventory-item.types";

import type {
  InventoryMovementCostStatus,
  InventoryMovementDirection,
  InventoryMovementType,
  InventoryReturnKind,
} from "../inventory-movements/inventory-movement.types";

type InventoryReportPeriod = Readonly<{
  from: string;
  to: string;
  timezone: string;
  start: string;
  end: string;
}>;

type InventoryReportFilters = Readonly<{
  period?: InventoryReportPeriod;
  locationId?: string;
  inventoryItemId?: string;
  movementType?: InventoryMovementType;
  page: number;
  pageSize: number;
}>;

type InventoryReportLocation = Readonly<{
  id: string;
  code: string;
  name: string;
}>;

type InventoryReportScope =
  | Readonly<{
      type: "BUSINESS";
      location: null;
    }>
  | Readonly<{
      type: "LOCATION";
      location: InventoryReportLocation;
    }>;

type InventorySummary = Readonly<{
  locationCount: number;
  balanceCount: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  unvaluedStockCount: number;
  totalInventoryValue: string | null;
  hasUnvaluedStock: boolean;
}>;

type InventorySummaryByLocation = Readonly<{
  location: InventoryReportLocation;
  balanceCount: number;
  unvaluedStockCount: number;
  totalInventoryValue: string | null;
}>;

type UnvaluedInventoryItem = Readonly<{
  inventoryItemId: string;
  sku: string | null;
  name: string;
  itemType: InventoryItemType;
  baseUnit: InventoryUnit;

  location: InventoryReportLocation;

  currentStock: string;
  minimumStock: string;
  migratedFromLegacy: boolean;
  updatedAt: Date;
}>;

type InventoryKardexItem = Readonly<{
  movementLineId: string;
  movementId: string;

  location: InventoryReportLocation | null;

  inventoryItemId: string;
  sku: string | null;
  inventoryItemName: string;
  baseUnit: InventoryUnit;

  movementType: InventoryMovementType;
  returnKind: InventoryReturnKind | null;

  direction: InventoryMovementDirection;
  quantity: string;

  balanceBefore: string;
  balanceAfter: string;

  unitCost: string | null;
  totalCost: string | null;

  averageUnitCostBefore: string | null;
  averageUnitCostAfter: string | null;

  inventoryValueBefore: string | null;
  inventoryValueAfter: string | null;

  costStatus: InventoryMovementCostStatus;

  externalReference: string | null;
  notes: string | null;

  createdByMembershipId: string;
  createdByName: string;
  createdAt: Date;
}>;

type InventoryPurchaseHistoryItem = Readonly<{
  movementId: string;
  movementLineId: string;

  location: InventoryReportLocation | null;

  supplierName: string | null;
  supplierDocument: string | null;
  externalReference: string | null;
  documentDate: string | null;

  inventoryItemId: string;
  sku: string | null;
  inventoryItemName: string;
  baseUnit: InventoryUnit;

  presentationName: string | null;
  purchasedQuantity: string | null;
  baseQuantity: string;

  grossCost: string | null;
  discountAmount: string | null;
  additionalCostAmount: string | null;
  netCost: string | null;

  purchaseUnitCost: string | null;
  previousAverageUnitCost: string | null;
  newAverageUnitCost: string | null;
  averageCostVariationPercentage: string | null;

  costStatus: InventoryMovementCostStatus;

  createdByName: string;
  createdAt: Date;
}>;

type Pagination = Readonly<{
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

type InventoryKardexResult = Readonly<{
  entries: readonly InventoryKardexItem[];
  pagination: Pagination;
}>;

type InventoryPurchaseHistoryResult = Readonly<{
  purchases: readonly InventoryPurchaseHistoryItem[];
  pagination: Pagination;
}>;

type InventoryReconciliationIssue =
  | "PHYSICAL_STOCK_MISMATCH"
  | "NEGATIVE_LOCATION_STOCK"
  | "UNVALUED_LOCATION_STOCK";

type InventoryReconciliationItem = Readonly<{
  inventoryItemId: string;
  sku: string | null;
  name: string;
  globalStock: string;
  locationStock: string;
  difference: string;
  negativeLocationCount: number;
  unvaluedLocationCount: number;
  issues: readonly InventoryReconciliationIssue[];
}>;

type InventoryReconciliationSummary = Readonly<{
  inventoryItemCount: number;
  inconsistentItemCount: number;
  physicalMismatchCount: number;
  negativeBalanceCount: number;
  unvaluedBalanceCount: number;
  movementWithoutLocationCount: number;
  unvaluedMovementLineCount: number;
  isPhysicallyConsistent: boolean;
  hasLegacyAuditGaps: boolean;
}>;

type InventoryReconciliationResult = Readonly<{
  summary: InventoryReconciliationSummary;
  items: readonly InventoryReconciliationItem[];
}>;

export type {
  InventoryKardexItem,
  InventoryKardexResult,
  InventoryPurchaseHistoryItem,
  InventoryPurchaseHistoryResult,
  InventoryReportFilters,
  InventoryReportLocation,
  InventoryReportPeriod,
  InventoryReportScope,
  InventorySummary,
  InventorySummaryByLocation,
  Pagination,
  UnvaluedInventoryItem,
  InventoryReconciliationIssue,
  InventoryReconciliationItem,
  InventoryReconciliationResult,
  InventoryReconciliationSummary,
};
