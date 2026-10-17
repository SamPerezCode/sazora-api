type InventoryMovementType =
  | "OPENING"
  | "PURCHASE"
  | "PRODUCTION"
  | "SALE"
  | "ADJUSTMENT"
  | "WASTE"
  | "RETURN"
  | "REVERSAL";

type ManualInventoryMovementType = "ADJUSTMENT" | "WASTE" | "RETURN";

type InventoryMovementDirection = "IN" | "OUT";

type InventoryReturnKind = "CUSTOMER_RETURN" | "SUPPLIER_RETURN";

type InventoryMovementCostStatus = "UNVALUED_LEGACY" | "VALUED";

type NewInventoryMovementLine = Readonly<{
  inventoryItemId: string;
  direction: InventoryMovementDirection;
  quantity: string;
  unitCost: string | null;
  notes: string | null;
}>;

type CreateInventoryMovementData = Readonly<{
  locationId: string;
  movementType: ManualInventoryMovementType;
  returnKind: InventoryReturnKind | null;
  externalReference: string | null;
  notes: string;
  lines: readonly NewInventoryMovementLine[];
}>;

/*
 * Contrato temporal utilizado por producción mientras ese módulo
 * todavía trabaja con el inventario global anterior.
 *
 * Se eliminará cuando implementemos el punto 11.
 */
type LegacyInventoryMovementLine = Readonly<{
  inventoryItemId: string;
  direction: InventoryMovementDirection;
  quantity: string;
  notes: string | null;
}>;

type CreateLegacyInventoryMovementData = Readonly<{
  movementType: "PRODUCTION";
  notes: string | null;
  lines: readonly LegacyInventoryMovementLine[];
}>;

type InventoryMovementLocation = Readonly<{
  id: string;
  code: string;
  name: string;
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

  unitCost: string | null;
  totalCost: string | null;

  averageUnitCostBefore: string | null;
  averageUnitCostAfter: string | null;

  inventoryValueBefore: string | null;
  inventoryValueAfter: string | null;

  costStatus: InventoryMovementCostStatus;

  notes: string | null;
  createdAt: Date;
}>;

type InventoryMovement = Readonly<{
  id: string;
  businessId: string;

  location: InventoryMovementLocation | null;

  movementType: InventoryMovementType;
  returnKind: InventoryReturnKind | null;

  sourceType: string | null;
  sourceId: string | null;
  externalReference: string | null;

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
  CreateLegacyInventoryMovementData,
  InventoryMovement,
  InventoryMovementCostStatus,
  InventoryMovementDirection,
  InventoryMovementLine,
  InventoryMovementLocation,
  InventoryMovementSummary,
  InventoryMovementType,
  InventoryReturnKind,
  LegacyInventoryMovementLine,
  ManualInventoryMovementType,
  NewInventoryMovementLine,
};
