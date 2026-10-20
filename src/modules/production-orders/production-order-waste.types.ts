type ProductionOrderWasteItemKind = "INPUT" | "OUTPUT";

type ProductionOrderWasteLine = Readonly<{
  inventoryMovementLineId: string;

  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  baseUnit: string;

  itemKind: ProductionOrderWasteItemKind;

  quantity: string;
  unitCost: string;
  totalCost: string;

  balanceBefore: string;
  balanceAfter: string;

  notes: string | null;
}>;

type ProductionOrderWasteRecord = Readonly<{
  id: string;
  businessId: string;
  productionOrderId: string;
  inventoryMovementId: string;

  locationId: string;
  locationCode: string;
  locationName: string;

  reason: string;

  recordedByMembershipId: string;
  recordedByName: string;

  totalCost: string;
  createdAt: Date;

  lines: readonly ProductionOrderWasteLine[];
}>;

type NewProductionOrderWasteLine = Readonly<{
  inventoryItemId: string;
  quantity: string;
  notes: string | null;
}>;

type CreateProductionOrderWasteData = Readonly<{
  version: number;
  reason: string;
  lines: readonly NewProductionOrderWasteLine[];
}>;

type CreateProductionOrderWasteResult =
  | Readonly<{
      kind: "CREATED";
      wasteRecord: ProductionOrderWasteRecord;
    }>
  | Readonly<{
      kind:
        | "ORDER_NOT_FOUND"
        | "ORDER_NOT_IN_PROGRESS"
        | "VERSION_CONFLICT"
        | "LINES_MISMATCH";
    }>;

export type {
  CreateProductionOrderWasteData,
  CreateProductionOrderWasteResult,
  NewProductionOrderWasteLine,
  ProductionOrderWasteItemKind,
  ProductionOrderWasteLine,
  ProductionOrderWasteRecord,
};
