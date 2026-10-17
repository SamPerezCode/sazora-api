import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import { AppError } from "../../../shared/errors/app-error";

import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

import type { InventoryMovement } from "../../inventory-movements/inventory-movement.types";

import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";

import { findInventoryMovementById } from "../../inventory-movements/repositories/inventory-movement.repository";

import type { CreateProductionData } from "../production.types";

type LocationRow = RowDataPacket & {
  isActive: number;
  isInventoryLocation: number;
};

type InventoryBalanceRow = RowDataPacket & {
  inventoryItemId: string;
  isActive: number;

  currentStock: string | null;
  averageUnitCost: string | null;
  inventoryValue: string | null;

  valuationStatus: "UNVALUED" | "VALUED" | null;
};

const QUANTITY_SCALE = 3;
const COST_SCALE = 6;
const PERCENTAGE_SCALE = 6;

const ONE_HUNDRED_PERCENT = 100n * 10n ** BigInt(PERCENTAGE_SCALE);

const roundPositiveDivision = (
  numerator: bigint,
  denominator: bigint,
): bigint => {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error("La división recibió valores inválidos");
  }

  return (numerator + denominator / 2n) / denominator;
};

const multiplyQuantityByCost = (quantity: bigint, unitCost: bigint): bigint =>
  roundPositiveDivision(quantity * unitCost, 10n ** BigInt(QUANTITY_SCALE));

const divideValueByQuantity = (value: bigint, quantity: bigint): bigint =>
  roundPositiveDivision(value * 10n ** BigInt(QUANTITY_SCALE), quantity);

const createValuedProductionRecord = async (
  businessId: string,
  membershipId: string,
  data: CreateProductionData,
): Promise<InventoryMovement> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [locationRows] = await connection.execute<LocationRow[]>(
      `
          SELECT
            is_active AS isActive,
            is_inventory_location
              AS isInventoryLocation
          FROM business_locations
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, data.locationId],
    );

    const location = locationRows[0];

    if (!location) {
      throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
    }

    if (location.isActive !== 1) {
      throw new AppError(
        "La ubicación está inactiva",
        409,
        "LOCATION_INACTIVE",
      );
    }

    if (location.isInventoryLocation !== 1) {
      throw new AppError(
        "La ubicación no está habilitada para inventario",
        409,
        "LOCATION_NOT_INVENTORY_ENABLED",
      );
    }

    const inventoryItemIds = [
      ...new Set([
        ...data.inputs.map((input) => input.inventoryItemId),
        ...data.outputs.map((output) => output.inventoryItemId),
      ]),
    ].sort((first, second) => {
      const firstId = BigInt(first);
      const secondId = BigInt(second);

      if (firstId < secondId) {
        return -1;
      }

      if (firstId > secondId) {
        return 1;
      }

      return 0;
    });

    const placeholders = inventoryItemIds.map(() => "?").join(", ");

    const [itemRows] = await connection.execute<InventoryBalanceRow[]>(
      `
          SELECT
            CAST(ii.id AS CHAR)
              AS inventoryItemId,

            ii.is_active AS isActive,

            CAST(ilb.current_stock AS CHAR)
              AS currentStock,

            CAST(ilb.average_unit_cost AS CHAR)
              AS averageUnitCost,

            CAST(ilb.inventory_value AS CHAR)
              AS inventoryValue,

            ilb.valuation_status
              AS valuationStatus

          FROM inventory_items AS ii

          LEFT JOIN inventory_location_balances AS ilb
            ON ilb.business_id = ii.business_id
            AND ilb.inventory_item_id = ii.id
            AND ilb.location_id = ?

          WHERE
            ii.business_id = ?
            AND ii.id IN (${placeholders})

          ORDER BY ii.id ASC

          FOR UPDATE
        `,
      [data.locationId, businessId, ...inventoryItemIds],
    );

    const itemById = new Map(
      itemRows.map((item) => [item.inventoryItemId, item]),
    );

    for (const inventoryItemId of inventoryItemIds) {
      const item = itemById.get(inventoryItemId);

      if (item?.isActive !== 1) {
        throw new AppError(
          `El artículo ${inventoryItemId} no existe o está inactivo`,
          409,
          "INVENTORY_ITEM_NOT_AVAILABLE",
        );
      }
    }

    let totalConsumedCost = 0n;

    for (const input of data.inputs) {
      const balance = itemById.get(input.inventoryItemId);

      if (balance?.currentStock == null) {
        throw new AppError(
          `No existe inventario del artículo ${input.inventoryItemId} en esta ubicación`,
          409,
          "INSUFFICIENT_PRODUCTION_STOCK",
        );
      }

      const currentStock = decimalToScaledBigInt(
        balance.currentStock,
        QUANTITY_SCALE,
      );

      const requestedQuantity = decimalToScaledBigInt(
        input.quantity,
        QUANTITY_SCALE,
      );

      if (currentStock < requestedQuantity) {
        throw new AppError(
          `Stock insuficiente para el insumo ` +
            `${input.inventoryItemId}. ` +
            `Disponible: ${balance.currentStock}. ` +
            `Solicitado: ${input.quantity}`,
          409,
          "INSUFFICIENT_PRODUCTION_STOCK",
        );
      }

      if (
        balance.valuationStatus !== "VALUED" ||
        balance.averageUnitCost === null ||
        balance.inventoryValue === null
      ) {
        throw new AppError(
          `El insumo ${input.inventoryItemId} tiene existencias sin valorar`,
          409,
          "UNVALUED_PRODUCTION_INPUT",
        );
      }

      const averageUnitCost = decimalToScaledBigInt(
        balance.averageUnitCost,
        COST_SCALE,
      );

      const inventoryValue = decimalToScaledBigInt(
        balance.inventoryValue,
        COST_SCALE,
      );

      /*
       * Cuando se consume todo el saldo retiramos exactamente
       * todo su valor, evitando residuos por redondeo.
       */
      const consumedCost =
        requestedQuantity === currentStock
          ? inventoryValue
          : multiplyQuantityByCost(requestedQuantity, averageUnitCost);

      totalConsumedCost += consumedCost;
    }

    let allocatedCost = 0n;

    const outputLines = data.outputs.map((output, index) => {
      const outputQuantity = decimalToScaledBigInt(
        output.quantity,
        QUANTITY_SCALE,
      );

      const isLastOutput = index === data.outputs.length - 1;

      let outputTotalCost: bigint;

      if (isLastOutput) {
        /*
         * El último resultado recibe cualquier residuo
         * producido por el redondeo.
         */
        outputTotalCost = totalConsumedCost - allocatedCost;
      } else {
        const percentage = decimalToScaledBigInt(
          output.costAllocationPercentage ?? "100.000000",
          PERCENTAGE_SCALE,
        );

        outputTotalCost = roundPositiveDivision(
          totalConsumedCost * percentage,
          ONE_HUNDRED_PERCENT,
        );

        allocatedCost += outputTotalCost;
      }

      const outputUnitCost = divideValueByQuantity(
        outputTotalCost,
        outputQuantity,
      );

      return {
        inventoryItemId: output.inventoryItemId,
        direction: "IN" as const,
        quantity: output.quantity,
        unitCost: scaledBigIntToDecimal(outputUnitCost, COST_SCALE),
        totalCost: scaledBigIntToDecimal(outputTotalCost, COST_SCALE),
        notes: output.notes,
      };
    });

    const movementResult = await applyLocationInventoryMovement(
      connection,
      businessId,
      membershipId,
      {
        locationId: data.locationId,

        movementType: "PRODUCTION",

        returnKind: null,

        sourceType: "PRODUCTION_BATCH",

        sourceId: null,

        externalReference: null,

        notes: data.notes ?? "Producción de inventario",

        lines: [
          ...data.inputs.map((input) => ({
            inventoryItemId: input.inventoryItemId,
            direction: "OUT" as const,
            quantity: input.quantity,
            unitCost: null,
            totalCost: null,
            notes: input.notes,
          })),

          ...outputLines,
        ],
      },
    );

    switch (movementResult.kind) {
      case "APPLIED":
        break;

      case "ITEM_NOT_AVAILABLE":
        throw new AppError(
          `El artículo ${movementResult.inventoryItemId} no está disponible`,
          409,
          "INVENTORY_ITEM_NOT_AVAILABLE",
        );

      case "INSUFFICIENT_STOCK":
        throw new AppError(
          `Stock insuficiente para el artículo ` +
            `${movementResult.inventoryItemId}`,
          409,
          "INSUFFICIENT_PRODUCTION_STOCK",
        );

      case "UNVALUED_STOCK":
        throw new AppError(
          `El artículo ${movementResult.inventoryItemId} tiene existencias sin valorar`,
          409,
          "UNVALUED_PRODUCTION_INVENTORY",
        );

      case "UNIT_COST_REQUIRED":
        throw new AppError(
          `No fue posible calcular el costo del artículo ` +
            `${movementResult.inventoryItemId}`,
          409,
          "PRODUCTION_UNIT_COST_REQUIRED",
        );

      case "LOCATION_NOT_FOUND":
      case "LOCATION_INACTIVE":
      case "LOCATION_NOT_INVENTORY_ENABLED":
        throw new AppError(
          "La ubicación de producción no está disponible",
          409,
          "PRODUCTION_LOCATION_NOT_AVAILABLE",
        );
    }

    await connection.commit();

    const movement = await findInventoryMovementById(
      businessId,
      movementResult.movementId,
    );

    if (!movement) {
      throw new Error("No fue posible recuperar la producción creada");
    }

    return movement;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createValuedProductionRecord };
