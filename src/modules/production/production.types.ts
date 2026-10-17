type ProductionInput = Readonly<{
  inventoryItemId: string;
  quantity: string;
  notes: string | null;
}>;

type ProductionOutput = Readonly<{
  inventoryItemId: string;
  quantity: string;

  /**
   * Porcentaje del costo total consumido que recibe este resultado.
   * Puede ser null solamente cuando existe un único resultado.
   */
  costAllocationPercentage: string | null;

  notes: string | null;
}>;

type CreateProductionData = Readonly<{
  locationId: string;
  notes: string | null;
  inputs: readonly ProductionInput[];
  outputs: readonly ProductionOutput[];
}>;

export type { CreateProductionData, ProductionInput, ProductionOutput };
