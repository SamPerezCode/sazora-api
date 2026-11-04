type InventoryTransferLocation = Readonly<{
  id: string;
  code: string;
  name: string;
}>;

type NewInventoryTransferLine = Readonly<{
  inventoryItemId: string;
  quantity: string;
  notes: string | null;
}>;

type CreateInventoryTransferData = Readonly<{
  sourceLocationId: string;
  destinationLocationId: string;

  externalReference: string | null;
  notes: string;

  lines: readonly NewInventoryTransferLine[];
}>;

type InventoryTransferLine = Readonly<{
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: string;

  quantity: string;
  unitCost: string;
  totalCost: string;

  notes: string | null;
}>;

type InventoryTransfer = Readonly<{
  id: string;
  businessId: string;

  sourceLocation: InventoryTransferLocation;
  destinationLocation: InventoryTransferLocation;

  sourceMovementId: string;
  destinationMovementId: string;

  status: "COMPLETED";

  externalReference: string | null;
  notes: string;

  createdByMembershipId: string;
  createdAt: Date;
  completedAt: Date;

  lines: readonly InventoryTransferLine[];
}>;

export type {
  CreateInventoryTransferData,
  InventoryTransfer,
  InventoryTransferLine,
  InventoryTransferLocation,
  NewInventoryTransferLine,
};
