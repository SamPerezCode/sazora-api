import { AppError } from "../../../shared/errors/app-error";

import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

import type {
  CreateInventoryPurchaseData,
  CreateInventoryPurchaseRecordData,
  InventoryPurchase,
} from "../inventory-purchase.types";

import {
  createInventoryPurchaseRecord,
  findInventoryPurchaseById,
} from "../repositories/inventory-purchase.repository";

const MONEY_SCALE = 6;

const getInventoryPurchase = async (
  businessId: string,
  movementId: string,
): Promise<InventoryPurchase> => {
  const purchase = await findInventoryPurchaseById(businessId, movementId);

  if (!purchase) {
    throw new AppError(
      "La compra de inventario no existe o no tiene costos valorados",
      404,
      "INVENTORY_PURCHASE_NOT_FOUND",
    );
  }

  return purchase;
};

const calculatePurchaseCosts = (
  data: CreateInventoryPurchaseData,
): CreateInventoryPurchaseRecordData => {
  let grossTotal = 0n;
  let discountTotal = 0n;
  let additionalCostTotal = 0n;
  let netTotal = 0n;

  const lines = data.lines.map((line) => {
    const grossCost = decimalToScaledBigInt(line.grossCost, MONEY_SCALE);

    const discountAmount = decimalToScaledBigInt(
      line.discountAmount,
      MONEY_SCALE,
    );

    const additionalCostAmount = decimalToScaledBigInt(
      line.additionalCostAmount,
      MONEY_SCALE,
    );

    const netCost = grossCost - discountAmount + additionalCostAmount;

    if (discountAmount > grossCost) {
      throw new AppError(
        "El descuento no puede superar el costo bruto",
        400,
        "PURCHASE_DISCOUNT_EXCEEDS_GROSS_COST",
      );
    }

    if (netCost <= 0n) {
      throw new AppError(
        "El costo neto de cada línea debe ser mayor que cero",
        400,
        "PURCHASE_NET_COST_MUST_BE_POSITIVE",
      );
    }

    grossTotal += grossCost;
    discountTotal += discountAmount;
    additionalCostTotal += additionalCostAmount;
    netTotal += netCost;

    return {
      ...line,
      grossCost: scaledBigIntToDecimal(grossCost, MONEY_SCALE),
      discountAmount: scaledBigIntToDecimal(discountAmount, MONEY_SCALE),
      additionalCostAmount: scaledBigIntToDecimal(
        additionalCostAmount,
        MONEY_SCALE,
      ),
      netCost: scaledBigIntToDecimal(netCost, MONEY_SCALE),
    };
  });

  return {
    ...data,
    grossTotal: scaledBigIntToDecimal(grossTotal, MONEY_SCALE),
    discountTotal: scaledBigIntToDecimal(discountTotal, MONEY_SCALE),
    additionalCostTotal: scaledBigIntToDecimal(
      additionalCostTotal,
      MONEY_SCALE,
    ),
    netTotal: scaledBigIntToDecimal(netTotal, MONEY_SCALE),
    lines,
  };
};

const createInventoryPurchase = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryPurchaseData,
): Promise<InventoryPurchase> => {
  const recordData = calculatePurchaseCosts(data);

  const result = await createInventoryPurchaseRecord(
    businessId,
    membershipId,
    recordData,
  );

  switch (result.kind) {
    case "CREATED":
      return result.purchase;

    case "LOCATION_NOT_FOUND":
      throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");

    case "LOCATION_INACTIVE":
      throw new AppError(
        "La ubicación está inactiva",
        409,
        "LOCATION_INACTIVE",
      );

    case "LOCATION_NOT_INVENTORY_ENABLED":
      throw new AppError(
        "La ubicación no administra inventario",
        409,
        "LOCATION_NOT_INVENTORY_ENABLED",
      );

    case "PRESENTATIONS_NOT_AVAILABLE":
      throw new AppError(
        `Algunas presentaciones no existen o están inactivas: ${result.presentationIds.join(", ")}`,
        409,
        "PURCHASE_PRESENTATIONS_NOT_AVAILABLE",
      );

    case "PRESENTATION_ITEM_MISMATCH":
      throw new AppError(
        `La presentación ${result.presentationId} no pertenece al artículo ${result.inventoryItemId}`,
        409,
        "PURCHASE_PRESENTATION_ITEM_MISMATCH",
      );

    case "UNVALUED_STOCK":
      throw new AppError(
        `El artículo ${result.inventoryItemId} tiene existencias sin valorar. Debes registrar primero su valoración inicial`,
        409,
        "INVENTORY_STOCK_UNVALUED",
      );

    case "NEGATIVE_STOCK":
      throw new AppError(
        `El artículo ${result.inventoryItemId} tiene saldo negativo (${result.currentStock}). Debe reconciliarse antes de registrar una compra`,
        409,
        "NEGATIVE_INVENTORY_STOCK",
      );

    case "BASE_QUANTITY_TOO_SMALL":
      throw new AppError(
        `La conversión del artículo ${result.inventoryItemId} produce una cantidad base menor a 0.001`,
        409,
        "PURCHASE_BASE_QUANTITY_TOO_SMALL",
      );
  }
};

export { createInventoryPurchase, getInventoryPurchase };
