import { AppError } from "../../../shared/errors/app-error";

import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

import type { AuthenticatedSession } from "../../auth/auth.types";

import { findProductionOrderPerformanceSource } from "../repositories/production-order-performance.repository";

import type {
  ProductionOrderPerformanceReport,
  ProductionPerformanceInput,
  ProductionPerformanceOutput,
  ProductionPerformanceQuantity,
} from "../production-order-performance.types";

import { getProductionOrder } from "./production-order.service";

const QUANTITY_SCALE = 3;
const COST_SCALE = 6;
const PERCENTAGE_SCALE = 6;

const QUANTITY_FACTOR = 10n ** BigInt(QUANTITY_SCALE);
const PERCENTAGE_FACTOR = 10n ** BigInt(PERCENTAGE_SCALE);

const divideAndRound = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= 0n) {
    throw new Error("El divisor debe ser mayor que cero");
  }

  const isNegative = numerator < 0n;
  const absoluteNumerator = isNegative ? -numerator : numerator;

  const rounded = (absoluteNumerator + denominator / 2n) / denominator;

  return isNegative ? -rounded : rounded;
};

const calculatePercentage = (
  numerator: bigint,
  denominator: bigint,
): string | null => {
  if (denominator === 0n) {
    return null;
  }

  const scaledPercentage = divideAndRound(
    numerator * 100n * PERCENTAGE_FACTOR,
    denominator,
  );

  return scaledBigIntToDecimal(scaledPercentage, PERCENTAGE_SCALE);
};

const multiplyQuantityByUnitCost = (
  quantity: bigint,
  unitCost: bigint,
): bigint => divideAndRound(quantity * unitCost, QUANTITY_FACTOR);

const buildQuantityPerformance = (
  plannedQuantityValue: string,
  actualQuantityValue: string | null,
): ProductionPerformanceQuantity => {
  if (actualQuantityValue === null) {
    return {
      plannedQuantity: plannedQuantityValue,
      actualQuantity: null,
      differenceQuantity: null,
      variationPercentage: null,
    };
  }

  const plannedQuantity = decimalToScaledBigInt(
    plannedQuantityValue,
    QUANTITY_SCALE,
  );

  const actualQuantity = decimalToScaledBigInt(
    actualQuantityValue,
    QUANTITY_SCALE,
  );

  const differenceQuantity = actualQuantity - plannedQuantity;

  return {
    plannedQuantity: plannedQuantityValue,
    actualQuantity: actualQuantityValue,

    differenceQuantity: scaledBigIntToDecimal(
      differenceQuantity,
      QUANTITY_SCALE,
    ),

    variationPercentage: calculatePercentage(
      differenceQuantity,
      plannedQuantity,
    ),
  };
};

const sumNullableValues = (
  values: readonly (bigint | null)[],
): bigint | null => {
  let total = 0n;

  for (const value of values) {
    if (value === null) {
      return null;
    }

    total += value;
  }

  return total;
};

const getProductionOrderPerformance = async (
  auth: AuthenticatedSession,
  productionOrderId: string,
): Promise<ProductionOrderPerformanceReport> => {
  /*
   * Esta consulta valida que la orden exista y que el usuario
   * tenga acceso a la planta correspondiente.
   */
  await getProductionOrder(auth, productionOrderId);

  const source = await findProductionOrderPerformanceSource(
    auth.businessId,
    productionOrderId,
  );

  if (!source) {
    throw new AppError(
      "La orden de producción no existe",
      404,
      "PRODUCTION_ORDER_NOT_FOUND",
    );
  }

  const calculatedInputs = source.inputs.map((line) => {
    const quantityPerformance = buildQuantityPerformance(
      line.plannedQuantity,
      line.actualQuantity,
    );

    const plannedQuantity = decimalToScaledBigInt(
      line.plannedQuantity,
      QUANTITY_SCALE,
    );

    const actualUnitCost =
      line.actualUnitCost === null
        ? null
        : decimalToScaledBigInt(line.actualUnitCost, COST_SCALE);

    const expectedCost =
      actualUnitCost === null
        ? null
        : multiplyQuantityByUnitCost(plannedQuantity, actualUnitCost);

    const actualCost =
      line.actualTotalCost === null
        ? null
        : decimalToScaledBigInt(line.actualTotalCost, COST_SCALE);

    const costDifference =
      expectedCost === null || actualCost === null
        ? null
        : actualCost - expectedCost;

    const report: ProductionPerformanceInput = {
      inventoryItemId: line.inventoryItemId,
      inventoryItemName: line.inventoryItemName,
      inventoryItemSku: line.inventoryItemSku,
      baseUnit: line.baseUnit,

      ...quantityPerformance,

      actualUnitCost: line.actualUnitCost,

      expectedCostAtActualRate:
        expectedCost === null
          ? null
          : scaledBigIntToDecimal(expectedCost, COST_SCALE),

      actualCost: line.actualTotalCost,

      costDifference:
        costDifference === null
          ? null
          : scaledBigIntToDecimal(costDifference, COST_SCALE),

      costVariationPercentage:
        costDifference === null || expectedCost === null
          ? null
          : calculatePercentage(costDifference, expectedCost),

      declaredWasteQuantity: line.declaredWasteQuantity,

      declaredWasteCost: line.declaredWasteCost,
    };

    return {
      report,
      expectedCost,
      actualCost,
    };
  });

  const calculatedOutputs = source.outputs.map((line) => {
    const quantityPerformance = buildQuantityPerformance(
      line.plannedQuantity,
      line.actualQuantity,
    );

    const plannedQuantity = decimalToScaledBigInt(
      line.plannedQuantity,
      QUANTITY_SCALE,
    );

    const actualQuantity =
      line.actualQuantity === null
        ? null
        : decimalToScaledBigInt(line.actualQuantity, QUANTITY_SCALE);

    const actualCost =
      line.actualTotalCost === null
        ? null
        : decimalToScaledBigInt(line.actualTotalCost, COST_SCALE);

    const report: ProductionPerformanceOutput = {
      inventoryItemId: line.inventoryItemId,
      inventoryItemName: line.inventoryItemName,
      inventoryItemSku: line.inventoryItemSku,
      baseUnit: line.baseUnit,

      ...quantityPerformance,

      costAllocationPercentage: line.costAllocationPercentage,

      actualUnitCost: line.actualUnitCost,
      actualCost: line.actualTotalCost,

      yieldPercentage:
        actualQuantity === null
          ? null
          : calculatePercentage(actualQuantity, plannedQuantity),

      declaredWasteQuantity: line.declaredWasteQuantity,

      declaredWasteCost: line.declaredWasteCost,
    };

    return {
      report,
      actualCost,
    };
  });

  const expectedInputCost = sumNullableValues(
    calculatedInputs.map((line) => line.expectedCost),
  );

  const actualInputCost = sumNullableValues(
    calculatedInputs.map((line) => line.actualCost),
  );

  const inputCostDifference =
    expectedInputCost === null || actualInputCost === null
      ? null
      : actualInputCost - expectedInputCost;

  const declaredWasteCost = [...source.inputs, ...source.outputs].reduce(
    (total, line) =>
      total + decimalToScaledBigInt(line.declaredWasteCost, COST_SCALE),
    0n,
  );

  const producedInventoryValue = sumNullableValues(
    calculatedOutputs.map((line) => line.actualCost),
  );

  const totalResourceCost =
    actualInputCost === null ? null : actualInputCost + declaredWasteCost;

  return {
    productionOrderId: source.productionOrderId,
    businessId: source.businessId,

    status: source.status,
    batchQuantity: source.batchQuantity,

    recipeId: source.recipeId,
    recipeCode: source.recipeCode,
    recipeName: source.recipeName,

    locationId: source.locationId,
    locationCode: source.locationCode,
    locationName: source.locationName,

    inventoryMovementId: source.inventoryMovementId,

    plannedFor: source.plannedFor,
    startedAt: source.startedAt,
    completedAt: source.completedAt,

    completedByMembershipId: source.completedByMembershipId,

    completedByName: source.completedByName,

    inputs: calculatedInputs.map((line) => line.report),

    outputs: calculatedOutputs.map((line) => line.report),

    summary: {
      expectedInputCostAtActualRate:
        expectedInputCost === null
          ? null
          : scaledBigIntToDecimal(expectedInputCost, COST_SCALE),

      actualInputCost:
        actualInputCost === null
          ? null
          : scaledBigIntToDecimal(actualInputCost, COST_SCALE),

      inputCostDifference:
        inputCostDifference === null
          ? null
          : scaledBigIntToDecimal(inputCostDifference, COST_SCALE),

      inputCostVariationPercentage:
        inputCostDifference === null || expectedInputCost === null
          ? null
          : calculatePercentage(inputCostDifference, expectedInputCost),

      declaredWasteCost: scaledBigIntToDecimal(declaredWasteCost, COST_SCALE),

      totalResourceCost:
        totalResourceCost === null
          ? null
          : scaledBigIntToDecimal(totalResourceCost, COST_SCALE),

      producedInventoryValue:
        producedInventoryValue === null
          ? null
          : scaledBigIntToDecimal(producedInventoryValue, COST_SCALE),
    },
  };
};

export { getProductionOrderPerformance };
