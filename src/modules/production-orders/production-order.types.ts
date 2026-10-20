import type { InventoryUnit } from "../inventory-items/inventory-item.types";

type ProductionOrderStatus =
  "DRAFT" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type ProductionOrderLocation = Readonly<{
  id: string;
  name: string;
  code: string;
}>;

type ProductionOrderRecipe = Readonly<{
  id: string;
  code: string;
  name: string;
}>;

type ProductionOrderInput = Readonly<{
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  baseUnit: InventoryUnit;
  plannedQuantity: string;
  actualQuantity: string | null;
}>;

type ProductionOrderOutput = Readonly<{
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  baseUnit: InventoryUnit;
  plannedQuantity: string;
  actualQuantity: string | null;
  costAllocationPercentage: string;
}>;

type ProductionOrder = Readonly<{
  id: string;
  businessId: string;

  recipe: ProductionOrderRecipe;
  location: ProductionOrderLocation;

  status: ProductionOrderStatus;
  batchQuantity: string;
  plannedFor: Date | null;
  notes: string | null;

  inventoryMovementId: string | null;
  version: number;

  createdByMembershipId: string;
  createdByName: string;

  updatedByMembershipId: string;
  updatedByName: string;

  startedByMembershipId: string | null;
  startedByName: string | null;

  completedByMembershipId: string | null;
  completedByName: string | null;

  cancelledByMembershipId: string | null;
  cancelledByName: string | null;

  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;

  inputs: readonly ProductionOrderInput[];
  outputs: readonly ProductionOrderOutput[];
}>;

type ProductionOrderSummary = Omit<ProductionOrder, "inputs" | "outputs"> &
  Readonly<{
    inputCount: number;
    outputCount: number;
  }>;

type NewProductionOrderInputSnapshot = Readonly<{
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  baseUnit: InventoryUnit;
  plannedQuantity: string;
}>;

type NewProductionOrderOutputSnapshot = NewProductionOrderInputSnapshot &
  Readonly<{
    costAllocationPercentage: string;
  }>;

type SaveProductionOrderData = Readonly<{
  recipeId: string;
  locationId: string;
  batchQuantity: string;

  recipeCodeSnapshot: string;
  recipeNameSnapshot: string;

  plannedFor: Date | null;
  notes: string | null;

  inputs: readonly NewProductionOrderInputSnapshot[];
  outputs: readonly NewProductionOrderOutputSnapshot[];
}>;

type ProductionOrderListFilters = Readonly<{
  locationIds: readonly string[] | null;
  status: ProductionOrderStatus | null;
}>;

type UpdateProductionOrderResult =
  | Readonly<{
      kind: "UPDATED";
      productionOrder: ProductionOrder;
    }>
  | Readonly<{
      kind: "NOT_FOUND" | "NOT_DRAFT" | "VERSION_CONFLICT";
    }>;

type UpdateProductionOrderStatusResult =
  | Readonly<{
      kind: "UPDATED";
      productionOrder: ProductionOrder;
    }>
  | Readonly<{
      kind: "NOT_FOUND" | "VERSION_CONFLICT" | "INVALID_TRANSITION";
    }>;

type ProductionOrderCompletionLine = Readonly<{
  inventoryItemId: string;
  quantity: string;
}>;

type CompleteProductionOrderData = Readonly<{
  version: number;
  inputs: readonly ProductionOrderCompletionLine[];
  outputs: readonly ProductionOrderCompletionLine[];
}>;

type CompleteProductionOrderResult =
  | Readonly<{
      kind: "COMPLETED";
      productionOrder: ProductionOrder;
    }>
  | Readonly<{
      kind:
        | "NOT_FOUND"
        | "VERSION_CONFLICT"
        | "INVALID_TRANSITION"
        | "LINES_MISMATCH";
    }>;

export type {
  CompleteProductionOrderData,
  CompleteProductionOrderResult,
  NewProductionOrderInputSnapshot,
  NewProductionOrderOutputSnapshot,
  ProductionOrder,
  ProductionOrderCompletionLine,
  ProductionOrderInput,
  ProductionOrderListFilters,
  ProductionOrderLocation,
  ProductionOrderOutput,
  ProductionOrderRecipe,
  ProductionOrderStatus,
  ProductionOrderSummary,
  SaveProductionOrderData,
  UpdateProductionOrderResult,
  UpdateProductionOrderStatusResult,
};
