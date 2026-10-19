import { AppError } from "../../../shared/errors/app-error";
import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

import type { AuthenticatedSession } from "../../auth/auth.types";

import { findProductionRecipeById } from "../../production-recipes/repositories/production-recipe.repository";
import type { ProductionRecipe } from "../../production-recipes/production-recipe.types";

import {
  resolveProductionListScope,
  resolveProductionLocation,
} from "../../production/services/production-location-access.service";

import {
  findProductionOrderById,
  findProductionOrders,
  insertProductionOrder,
  startProductionOrderById,
  updateProductionOrderById,
  updateProductionOrderStatusById,
} from "../repositories/production-order.repository";

import type {
  ProductionOrder,
  ProductionOrderStatus,
  ProductionOrderSummary,
  SaveProductionOrderData,
} from "../production-order.types";

import type {
  CreateProductionOrderInput,
  StartProductionOrderInput,
  UpdateProductionOrderInput,
  UpdateProductionOrderStatusInput,
} from "../schemas/production-order.schema";

const QUANTITY_SCALE = 3;
const QUANTITY_FACTOR = 10n ** BigInt(QUANTITY_SCALE);

type ProductionOrderPayload = Readonly<{
  recipeId: string;
  locationId: string;
  batchQuantity: string;
  plannedFor: Date | null;
  notes: string | null;
}>;

type ProductionOrderListInput = Readonly<{
  locationId?: string | undefined;
  status?: ProductionOrderStatus | undefined;
}>;

const multiplyQuantity = (
  baseQuantity: string,
  batchQuantity: string,
): string => {
  const base = decimalToScaledBigInt(baseQuantity, QUANTITY_SCALE);

  const batch = decimalToScaledBigInt(batchQuantity, QUANTITY_SCALE);

  /*
   * Ambos operandos tienen escala 3.
   * El producto tiene escala 6 y se convierte nuevamente
   * a escala 3 usando redondeo positivo al valor más cercano.
   */
  const product = base * batch;

  const rounded = (product + QUANTITY_FACTOR / 2n) / QUANTITY_FACTOR;

  if (rounded <= 0n) {
    throw new AppError(
      "El lote produce una cantidad demasiado pequeña",
      409,
      "PRODUCTION_ORDER_QUANTITY_TOO_SMALL",
    );
  }

  return scaledBigIntToDecimal(rounded, QUANTITY_SCALE);
};

const getActiveRecipe = async (
  businessId: string,
  recipeId: string,
): Promise<ProductionRecipe> => {
  const recipe = await findProductionRecipeById(businessId, recipeId);

  if (!recipe) {
    throw new AppError(
      "La receta de producción no existe",
      404,
      "PRODUCTION_RECIPE_NOT_FOUND",
    );
  }

  if (!recipe.isActive) {
    throw new AppError(
      "La receta de producción está inactiva",
      409,
      "PRODUCTION_RECIPE_INACTIVE",
    );
  }

  if (recipe.inputs.length === 0 || recipe.outputs.length === 0) {
    throw new AppError(
      "La receta debe tener insumos y productos obtenidos",
      409,
      "PRODUCTION_RECIPE_INCOMPLETE",
    );
  }

  return recipe;
};

const buildProductionOrderData = (
  recipe: ProductionRecipe,
  input: ProductionOrderPayload,
): SaveProductionOrderData => ({
  recipeId: recipe.id,
  locationId: input.locationId,
  batchQuantity: input.batchQuantity,

  recipeCodeSnapshot: recipe.code,
  recipeNameSnapshot: recipe.name,

  plannedFor: input.plannedFor,
  notes: input.notes,

  inputs: recipe.inputs.map((line) => ({
    inventoryItemId: line.inventoryItemId,
    inventoryItemName: line.inventoryItemName,
    inventoryItemSku: line.inventoryItemSku,
    baseUnit: line.baseUnit,

    plannedQuantity: multiplyQuantity(line.quantity, input.batchQuantity),
  })),

  outputs: recipe.outputs.map((line) => ({
    inventoryItemId: line.inventoryItemId,
    inventoryItemName: line.inventoryItemName,
    inventoryItemSku: line.inventoryItemSku,
    baseUnit: line.baseUnit,

    plannedQuantity: multiplyQuantity(line.quantity, input.batchQuantity),

    costAllocationPercentage: line.costAllocationPercentage,
  })),
});

const assertProductionOrderAccess = (
  auth: AuthenticatedSession,
  productionOrder: ProductionOrder,
): void => {
  if (auth.roles.includes("ADMIN")) {
    return;
  }

  const hasAccess = auth.locationAccess.locations.some(
    (location) =>
      location.id === productionOrder.location.id &&
      location.locationType === "PRODUCTION_WAREHOUSE",
  );

  if (!hasAccess) {
    throw new AppError(
      "No tienes acceso a la planta de esta orden",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }
};

const getProductionOrder = async (
  auth: AuthenticatedSession,
  productionOrderId: string,
): Promise<ProductionOrder> => {
  const productionOrder = await findProductionOrderById(
    auth.businessId,
    productionOrderId,
  );

  if (!productionOrder) {
    throw new AppError(
      "La orden de producción no existe",
      404,
      "PRODUCTION_ORDER_NOT_FOUND",
    );
  }

  assertProductionOrderAccess(auth, productionOrder);

  return productionOrder;
};

const listProductionOrders = async (
  auth: AuthenticatedSession,
  input: ProductionOrderListInput,
): Promise<ProductionOrderSummary[]> => {
  const accessibleLocationIds = await resolveProductionListScope(
    auth,
    input.locationId,
  );

  return findProductionOrders(auth.businessId, {
    locationIds: accessibleLocationIds ?? null,
    status: input.status ?? null,
  });
};

const createProductionOrder = async (
  auth: AuthenticatedSession,
  input: CreateProductionOrderInput,
): Promise<ProductionOrder> => {
  const [recipe, locationId] = await Promise.all([
    getActiveRecipe(auth.businessId, input.recipeId),

    resolveProductionLocation(auth, input.locationId),
  ]);

  const data = buildProductionOrderData(recipe, {
    recipeId: recipe.id,
    locationId,
    batchQuantity: input.batchQuantity,
    plannedFor: input.plannedFor,
    notes: input.notes,
  });

  return insertProductionOrder(auth.businessId, auth.membershipId, data);
};

const updateProductionOrder = async (
  auth: AuthenticatedSession,
  productionOrderId: string,
  input: UpdateProductionOrderInput,
): Promise<ProductionOrder> => {
  const currentOrder = await getProductionOrder(auth, productionOrderId);

  if (currentOrder.status !== "DRAFT") {
    throw new AppError(
      "Solo se pueden editar órdenes en borrador",
      409,
      "PRODUCTION_ORDER_NOT_DRAFT",
    );
  }

  const [recipe, locationId] = await Promise.all([
    getActiveRecipe(auth.businessId, input.recipeId),

    resolveProductionLocation(auth, input.locationId),
  ]);

  const data = buildProductionOrderData(recipe, {
    recipeId: recipe.id,
    locationId,
    batchQuantity: input.batchQuantity,
    plannedFor: input.plannedFor,
    notes: input.notes,
  });

  const result = await updateProductionOrderById(
    auth.businessId,
    auth.membershipId,
    productionOrderId,
    input.version,
    data,
  );

  switch (result.kind) {
    case "UPDATED":
      return result.productionOrder;

    case "NOT_FOUND":
      throw new AppError(
        "La orden de producción no existe",
        404,
        "PRODUCTION_ORDER_NOT_FOUND",
      );

    case "NOT_DRAFT":
      throw new AppError(
        "Solo se pueden editar órdenes en borrador",
        409,
        "PRODUCTION_ORDER_NOT_DRAFT",
      );

    case "VERSION_CONFLICT":
      throw new AppError(
        "La orden fue modificada por otra persona. Actualiza la información e inténtalo nuevamente",
        409,
        "PRODUCTION_ORDER_VERSION_CONFLICT",
      );
  }
};

const updateProductionOrderStatus = async (
  auth: AuthenticatedSession,
  productionOrderId: string,
  input: UpdateProductionOrderStatusInput,
): Promise<ProductionOrder> => {
  const currentOrder = await getProductionOrder(auth, productionOrderId);

  if (input.status === "PLANNED" && currentOrder.plannedFor === null) {
    throw new AppError(
      "Debes asignar una fecha antes de planificar la orden",
      409,
      "PRODUCTION_ORDER_PLANNED_DATE_REQUIRED",
    );
  }

  const result = await updateProductionOrderStatusById(
    auth.businessId,
    auth.membershipId,
    productionOrderId,
    input.version,
    input.status,
    input.cancellationReason,
  );

  switch (result.kind) {
    case "UPDATED":
      return result.productionOrder;

    case "NOT_FOUND":
      throw new AppError(
        "La orden de producción no existe",
        404,
        "PRODUCTION_ORDER_NOT_FOUND",
      );

    case "VERSION_CONFLICT":
      throw new AppError(
        "La orden fue modificada por otra persona. Actualiza la información e inténtalo nuevamente",
        409,
        "PRODUCTION_ORDER_VERSION_CONFLICT",
      );

    case "INVALID_TRANSITION":
      throw new AppError(
        "La orden no puede cambiar al estado solicitado",
        409,
        "PRODUCTION_ORDER_INVALID_TRANSITION",
      );
  }
};

const startProductionOrder = async (
  auth: AuthenticatedSession,
  productionOrderId: string,
  input: StartProductionOrderInput,
): Promise<ProductionOrder> => {
  const currentOrder = await getProductionOrder(auth, productionOrderId);

  if (currentOrder.status !== "PLANNED") {
    throw new AppError(
      "Solo se pueden iniciar órdenes planificadas",
      409,
      "PRODUCTION_ORDER_NOT_PLANNED",
    );
  }

  const result = await startProductionOrderById(
    auth.businessId,
    auth.membershipId,
    productionOrderId,
    input.version,
  );

  switch (result.kind) {
    case "UPDATED":
      return result.productionOrder;

    case "NOT_FOUND":
      throw new AppError(
        "La orden de producción no existe",
        404,
        "PRODUCTION_ORDER_NOT_FOUND",
      );

    case "VERSION_CONFLICT":
      throw new AppError(
        "La orden fue modificada por otra persona. Actualiza la información e inténtalo nuevamente",
        409,
        "PRODUCTION_ORDER_VERSION_CONFLICT",
      );

    case "INVALID_TRANSITION":
      throw new AppError(
        "La orden ya no se encuentra planificada",
        409,
        "PRODUCTION_ORDER_NOT_PLANNED",
      );
  }
};

export {
  createProductionOrder,
  getProductionOrder,
  listProductionOrders,
  startProductionOrder,
  updateProductionOrder,
  updateProductionOrderStatus,
};
