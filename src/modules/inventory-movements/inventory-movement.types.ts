type InventoryMovementType =
  | "OPENING"
  | "PURCHASE"
  | "PRODUCTION"
  | "SALE"
  | "ADJUSTMENT"
  | "WASTE"
  | "RETURN"
  | "REVERSAL";

type ManualInventoryMovementType =
  "PURCHASE" | "ADJUSTMENT" | "WASTE" | "RETURN";

type InventoryMovementDirection = "IN" | "OUT";

type NewInventoryMovementLine = Readonly<{
  inventoryItemId: string;
  direction: InventoryMovementDirection;
  quantity: string;
  notes: string | null;
}>;

type CreateInventoryMovementData = Readonly<{
  movementType: ManualInventoryMovementType | "PRODUCTION";
  notes: string | null;
  lines: readonly NewInventoryMovementLine[];
}>;

type InventoryMovementLine = Readonly<{
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: string;
  direction: InventoryMovementDirection;
  quantity: string;
  balanceBefore: string;
  balanceAfter: string;
  notes: string | null;
  createdAt: Date;
}>;

type InventoryMovement = Readonly<{
  id: string;
  businessId: string;
  movementType: InventoryMovementType;
  sourceType: string | null;
  sourceId: string | null;
  notes: string | null;
  createdByMembershipId: string;
  createdByName: string;
  createdAt: Date;
  lines: readonly InventoryMovementLine[];
}>;

type InventoryMovementSummary = Omit<InventoryMovement, "lines"> &
  Readonly<{
    lineCount: number;
  }>;

export type {
  CreateInventoryMovementData,
  InventoryMovement,
  InventoryMovementDirection,
  InventoryMovementLine,
  InventoryMovementSummary,
  InventoryMovementType,
  ManualInventoryMovementType,
  NewInventoryMovementLine,
};
