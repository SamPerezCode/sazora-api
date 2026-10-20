import type { InventoryUnit } from "../inventory-items/inventory-item.types";

import type { ProductionOrderStatus } from "./production-order.types";

type ProductionPerformanceQuantity = Readonly<{
  plannedQuantity: string;
  actualQuantity: string | null;

  differenceQuantity: string | null;
  variationPercentage: string | null;
}>;

type ProductionPerformanceInput = ProductionPerformanceQuantity &
  Readonly<{
    inventoryItemId: string;
    inventoryItemName: string;
    inventoryItemSku: string | null;
    baseUnit: InventoryUnit;

    /*
     * Costo histórico aplicado al completar la orden.
     */
    actualUnitCost: string | null;

    /*
     * Costo que habría tenido la cantidad planificada
     * usando el costo histórico real de la ejecución.
     */
    expectedCostAtActualRate: string | null;

    actualCost: string | null;
    costDifference: string | null;
    costVariationPercentage: string | null;

    declaredWasteQuantity: string;
    declaredWasteCost: string;
  }>;

type ProductionPerformanceOutput = ProductionPerformanceQuantity &
  Readonly<{
    inventoryItemId: string;
    inventoryItemName: string;
    inventoryItemSku: string | null;
    baseUnit: InventoryUnit;

    costAllocationPercentage: string;

    actualUnitCost: string | null;
    actualCost: string | null;

    /*
     * Cantidad real / cantidad planificada * 100.
     */
    yieldPercentage: string | null;

    declaredWasteQuantity: string;
    declaredWasteCost: string;
  }>;

type ProductionOrderPerformanceSummary = Readonly<{
  expectedInputCostAtActualRate: string | null;
  actualInputCost: string | null;

  inputCostDifference: string | null;
  inputCostVariationPercentage: string | null;

  declaredWasteCost: string;

  /*
   * Recursos retirados de inventario:
   * consumo productivo + desperdicio declarado.
   */
  totalResourceCost: string | null;

  producedInventoryValue: string | null;
}>;

type ProductionOrderPerformanceReport = Readonly<{
  productionOrderId: string;
  businessId: string;

  status: ProductionOrderStatus;
  batchQuantity: string;

  recipeId: string;
  recipeCode: string;
  recipeName: string;

  locationId: string;
  locationCode: string;
  locationName: string;

  inventoryMovementId: string | null;

  plannedFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;

  completedByMembershipId: string | null;
  completedByName: string | null;

  inputs: readonly ProductionPerformanceInput[];
  outputs: readonly ProductionPerformanceOutput[];

  summary: ProductionOrderPerformanceSummary;
}>;

/*
 * Tipos internos que el repositorio entrega al servicio.
 */

type ProductionPerformanceInputSource = Readonly<{
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  baseUnit: InventoryUnit;

  plannedQuantity: string;
  actualQuantity: string | null;

  actualUnitCost: string | null;
  actualTotalCost: string | null;

  declaredWasteQuantity: string;
  declaredWasteCost: string;
}>;

type ProductionPerformanceOutputSource = ProductionPerformanceInputSource &
  Readonly<{
    costAllocationPercentage: string;
  }>;

type ProductionOrderPerformanceSource = Readonly<{
  productionOrderId: string;
  businessId: string;

  status: ProductionOrderStatus;
  batchQuantity: string;

  recipeId: string;
  recipeCode: string;
  recipeName: string;

  locationId: string;
  locationCode: string;
  locationName: string;

  inventoryMovementId: string | null;

  plannedFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;

  completedByMembershipId: string | null;
  completedByName: string | null;

  inputs: readonly ProductionPerformanceInputSource[];

  outputs: readonly ProductionPerformanceOutputSource[];
}>;

export type {
  ProductionOrderPerformanceReport,
  ProductionOrderPerformanceSource,
  ProductionOrderPerformanceSummary,
  ProductionPerformanceInput,
  ProductionPerformanceInputSource,
  ProductionPerformanceOutput,
  ProductionPerformanceOutputSource,
  ProductionPerformanceQuantity,
};
