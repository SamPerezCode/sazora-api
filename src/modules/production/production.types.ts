type ProductionInput = Readonly<{
  inventoryItemId: string;
  quantity: string;
  notes: string | null;
}>;

type ProductionOutput = Readonly<{
  inventoryItemId: string;
  quantity: string;
  notes: string | null;
}>;

type CreateProductionData = Readonly<{
  notes: string | null;
  inputs: readonly ProductionInput[];
  outputs: readonly ProductionOutput[];
}>;

export type { CreateProductionData, ProductionInput, ProductionOutput };
