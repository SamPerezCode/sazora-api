import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import { AppError } from "../../../shared/errors/app-error";

import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";

import type {
  CompleteProductionOrderData,
  CompleteProductionOrderResult,
  ProductionOrderCompletionLine,
  ProductionOrderStatus,
} from "../production-order.types";

import { findProductionOrderById } from "./production-order.repository";

type LockedOrderRow = RowDataPacket & {
  id: string;
  locationId: string;
  status: ProductionOrderStatus;
  version: number;
  recipeCode: string;
  recipeName: string;
};

type OrderInputRow = RowDataPacket & {
  inventoryItemId: string;
};

type OrderOutputRow = RowDataPacket & {
  inventoryItemId: string;
  costAllocationPercentage: string;
};

type InputBalanceRow = RowDataPacket & {
  inventoryItemId: string;
  isActive: number;
  currentStock: string | null;
  averageUnitCost: string | null;
  inventoryValue: string | null;
  valuationStatus: "VALUED" | "UNVALUED" | null;
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

const mapCompletionLines = (
  lines: readonly ProductionOrderCompletionLine[],
): Map<string, string> => {
  return new Map(lines.map((line) => [line.inventoryItemId, line.quantity]));
};

const haveSameInventoryItems = (
  expectedIds: readonly string[],
  receivedLines: readonly ProductionOrderCompletionLine[],
): boolean => {
  if (expectedIds.length !== receivedLines.length) {
    return false;
  }

  const receivedIds = new Set(
    receivedLines.map((line) => line.inventoryItemId),
  );

  return expectedIds.every((id) => receivedIds.has(id));
};

const completeProductionOrderRecord = async (
  businessId: string,
  membershipId: string,
  productionOrderId: string,
  data: CompleteProductionOrderData,
): Promise<CompleteProductionOrderResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<LockedOrderRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,

            CAST(location_id AS CHAR)
              AS locationId,

            status,
            version,

            recipe_code_snapshot
              AS recipeCode,

            recipe_name_snapshot
              AS recipeName

          FROM production_orders

          WHERE
            business_id = ?
            AND id = ?

          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productionOrderId],
    );

    const order = orderRows[0];

    if (!order) {
      await connection.rollback();

      return {
        kind: "NOT_FOUND",
      };
    }

    if (order.version !== data.version) {
      await connection.rollback();

      return {
        kind: "VERSION_CONFLICT",
      };
    }

    if (order.status !== "IN_PROGRESS") {
      await connection.rollback();

      return {
        kind: "INVALID_TRANSITION",
      };
    }

    const [inputResult, outputResult] = await Promise.all([
      connection.execute<OrderInputRow[]>(
        `
            SELECT
              CAST(inventory_item_id AS CHAR)
                AS inventoryItemId

            FROM production_order_inputs

            WHERE
              business_id = ?
              AND production_order_id = ?

            ORDER BY inventory_item_id ASC
          `,
        [businessId, productionOrderId],
      ),

      connection.execute<OrderOutputRow[]>(
        `
            SELECT
              CAST(inventory_item_id AS CHAR)
                AS inventoryItemId,

              CAST(
                cost_allocation_percentage AS CHAR
              ) AS costAllocationPercentage

            FROM production_order_outputs

            WHERE
              business_id = ?
              AND production_order_id = ?

            ORDER BY inventory_item_id ASC
          `,
        [businessId, productionOrderId],
      ),
    ]);

    const orderInputs = inputResult[0];
    const orderOutputs = outputResult[0];

    const expectedInputIds = orderInputs.map((line) => line.inventoryItemId);

    const expectedOutputIds = orderOutputs.map((line) => line.inventoryItemId);

    if (
      !haveSameInventoryItems(expectedInputIds, data.inputs) ||
      !haveSameInventoryItems(expectedOutputIds, data.outputs)
    ) {
      await connection.rollback();

      return {
        kind: "LINES_MISMATCH",
      };
    }

    const inputQuantityByItemId = mapCompletionLines(data.inputs);

    const outputQuantityByItemId = mapCompletionLines(data.outputs);

    const inputPlaceholders = expectedInputIds.map(() => "?").join(", ");

    const [balanceRows] = await connection.execute<InputBalanceRow[]>(
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
            AND ii.id IN (${inputPlaceholders})

          ORDER BY ii.id ASC
          FOR UPDATE
        `,
      [order.locationId, businessId, ...expectedInputIds],
    );

    const balanceByItemId = new Map(
      balanceRows.map((balance) => [balance.inventoryItemId, balance]),
    );

    let totalConsumedCost = 0n;

    for (const input of data.inputs) {
      const balance = balanceByItemId.get(input.inventoryItemId);

      if (balance?.isActive !== 1) {
        throw new AppError(
          `El insumo ${input.inventoryItemId} no existe o está inactivo`,
          409,
          "INVENTORY_ITEM_NOT_AVAILABLE",
        );
      }

      if (balance.currentStock === null) {
        throw new AppError(
          `No existe inventario del insumo ${input.inventoryItemId} en esta ubicación`,
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
          `Stock insuficiente para el insumo ${input.inventoryItemId}. Disponible: ${balance.currentStock}. Solicitado: ${input.quantity}`,
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

      const consumedCost =
        requestedQuantity === currentStock
          ? inventoryValue
          : multiplyQuantityByCost(requestedQuantity, averageUnitCost);

      totalConsumedCost += consumedCost;
    }

    let allocatedCost = 0n;

    const outputLedgerLines = orderOutputs.map((output, index) => {
      const quantity = outputQuantityByItemId.get(output.inventoryItemId);

      if (!quantity) {
        throw new Error("No fue posible recuperar la cantidad producida");
      }

      const outputQuantity = decimalToScaledBigInt(quantity, QUANTITY_SCALE);

      const isLastOutput = index === orderOutputs.length - 1;

      let outputTotalCost: bigint;

      if (isLastOutput) {
        outputTotalCost = totalConsumedCost - allocatedCost;
      } else {
        const percentage = decimalToScaledBigInt(
          output.costAllocationPercentage,
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
        quantity,

        unitCost: scaledBigIntToDecimal(outputUnitCost, COST_SCALE),

        totalCost: scaledBigIntToDecimal(outputTotalCost, COST_SCALE),

        notes: `Resultado de la orden ${productionOrderId}`,
      };
    });

    const inputLedgerLines = orderInputs.map((input) => {
      const quantity = inputQuantityByItemId.get(input.inventoryItemId);

      if (!quantity) {
        throw new Error("No fue posible recuperar la cantidad consumida");
      }

      return {
        inventoryItemId: input.inventoryItemId,

        direction: "OUT" as const,
        quantity,
        unitCost: null,
        totalCost: null,

        notes: `Consumo de la orden ${productionOrderId}`,
      };
    });

    const movementResult = await applyLocationInventoryMovement(
      connection,
      businessId,
      membershipId,
      {
        locationId: order.locationId,
        movementType: "PRODUCTION",
        returnKind: null,

        sourceType: "PRODUCTION_ORDER",
        sourceId: productionOrderId,

        externalReference: `OP-${productionOrderId}`,

        notes: `Producción de ${order.recipeCode} - ${order.recipeName}`,

        lines: [...inputLedgerLines, ...outputLedgerLines],
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
          `Stock insuficiente para el artículo ${movementResult.inventoryItemId}. Disponible: ${movementResult.availableQuantity}. Solicitado: ${movementResult.requestedQuantity}`,
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
          `No fue posible determinar el costo del artículo ${movementResult.inventoryItemId}`,
          409,
          "PRODUCTION_UNIT_COST_REQUIRED",
        );

      case "LOCATION_NOT_FOUND":
        throw new AppError(
          "La ubicación de producción no existe",
          404,
          "LOCATION_NOT_FOUND",
        );

      case "LOCATION_INACTIVE":
        throw new AppError(
          "La ubicación de producción está inactiva",
          409,
          "LOCATION_INACTIVE",
        );

      case "LOCATION_NOT_INVENTORY_ENABLED":
        throw new AppError(
          "La ubicación no está habilitada para inventario",
          409,
          "LOCATION_NOT_INVENTORY_ENABLED",
        );
    }

    for (const input of data.inputs) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE production_order_inputs
          SET actual_quantity = ?
          WHERE
            business_id = ?
            AND production_order_id = ?
            AND inventory_item_id = ?
        `,
        [input.quantity, businessId, productionOrderId, input.inventoryItemId],
      );
    }

    for (const output of data.outputs) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE production_order_outputs
          SET actual_quantity = ?
          WHERE
            business_id = ?
            AND production_order_id = ?
            AND inventory_item_id = ?
        `,
        [
          output.quantity,
          businessId,
          productionOrderId,
          output.inventoryItemId,
        ],
      );
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE production_orders
        SET
          status = 'COMPLETED',
          inventory_movement_id = ?,
          completed_by_membership_id = ?,
          completed_at = CURRENT_TIMESTAMP,
          updated_by_membership_id = ?,
          version = version + 1

        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        movementResult.movementId,
        membershipId,
        membershipId,
        businessId,
        productionOrderId,
      ],
    );

    await connection.commit();

    const productionOrder = await findProductionOrderById(
      businessId,
      productionOrderId,
    );

    if (!productionOrder) {
      throw new Error("No fue posible recuperar la orden completada");
    }

    return {
      kind: "COMPLETED",
      productionOrder,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { completeProductionOrderRecord };
