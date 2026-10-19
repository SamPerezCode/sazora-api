import type {
  InventoryItemType,
  InventoryUnit,
} from "../inventory-items/inventory-item.types";

type ProductionRecipeInput = Readonly<{
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  inventoryItemType: InventoryItemType;
  baseUnit: InventoryUnit;
  quantity: string;
  notes: string | null;
}>;

type ProductionRecipeOutput = Readonly<{
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  inventoryItemType: InventoryItemType;
  baseUnit: InventoryUnit;
  quantity: string;
  costAllocationPercentage: string;
  notes: string | null;
}>;

type ProductionRecipe = Readonly<{
  id: string;
  businessId: string;
  code: string;
  name: string;
  notes: string | null;
  isActive: boolean;

  createdByMembershipId: string;
  createdByName: string;

  updatedByMembershipId: string;
  updatedByName: string;

  createdAt: Date;
  updatedAt: Date;

  inputs: readonly ProductionRecipeInput[];
  outputs: readonly ProductionRecipeOutput[];
}>;

type ProductionRecipeSummary = Omit<ProductionRecipe, "inputs" | "outputs"> &
  Readonly<{
    inputCount: number;
    outputCount: number;
  }>;

type NewProductionRecipeInput = Readonly<{
  inventoryItemId: string;
  quantity: string;
  notes: string | null;
}>;

type NewProductionRecipeOutput = Readonly<{
  inventoryItemId: string;
  quantity: string;
  costAllocationPercentage: string;
  notes: string | null;
}>;

type SaveProductionRecipeData = Readonly<{
  code: string;
  name: string;
  notes: string | null;

  inputs: readonly NewProductionRecipeInput[];
  outputs: readonly NewProductionRecipeOutput[];
}>;

export type {
  NewProductionRecipeInput,
  NewProductionRecipeOutput,
  ProductionRecipe,
  ProductionRecipeInput,
  ProductionRecipeOutput,
  ProductionRecipeSummary,
  SaveProductionRecipeData,
};
