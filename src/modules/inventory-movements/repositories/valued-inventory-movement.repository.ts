import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

import type {
  CreateInventoryMovementData,
  InventoryMovement,
} from "../inventory-movement.types";

import { findInventoryMovementById } from "./inventory-movement.repository";

type LocationRow = RowDataPacket & {
  isActive: number;
  isInventoryLocation: number;
};

type InventoryItemRow = RowDataPacket & {
  id: string;
};

type LockedBalanceRow = RowDataPacket & {
  inventoryItemId: string;
  currentStock: string;
  averageUnitCost: string | null;
  inventoryValue: string | null;
  valuationStatus: "UNVALUED" | "VALUED";
};

type CreateValuedMovementResult =
  | Readonly<{
      kind: "CREATED";
      movement: InventoryMovement;
    }>
  | Readonly<{
      kind: "LOCATION_NOT_FOUND";
    }>
  | Readonly<{
      kind: "LOCATION_INACTIVE";
    }>
  | Readonly<{
      kind: "LOCATION_NOT_INVENTORY_ENABLED";
    }>
  | Readonly<{
      kind: "ITEMS_NOT_AVAILABLE";
      inventoryItemIds: readonly string[];
    }>
  | Readonly<{
      kind: "UNVALUED_STOCK";
      inventoryItemId: string;
    }>
  | Readonly<{
      kind: "NEGATIVE_STOCK";
      inventoryItemId: string;
      currentStock: string;
    }>
  | Readonly<{
      kind: "INSUFFICIENT_STOCK";
      inventoryItemId: string;
      availableQuantity: string;
      requestedQuantity: string;
    }>
  | Readonly<{
      kind: "UNIT_COST_REQUIRED";
      inventoryItemId: string;
    }>
  | Readonly<{
      kind: "UNIT_COST_NOT_ALLOWED";
      inventoryItemId: string;
    }>;

const QUANTITY_SCALE = 3;
const COST_SCALE = 6;

const roundPositiveDivision = (
  numerator: bigint,
  denominator: bigint,
): bigint => {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error("La división decimal solamente admite valores positivos");
  }

  return (numerator + denominator / 2n) / denominator;
};

const multiplyQuantityByCost = (quantity: bigint, unitCost: bigint): bigint =>
  roundPositiveDivision(quantity * unitCost, 10n ** BigInt(QUANTITY_SCALE));

const divideValueByQuantity = (
  inventoryValue: bigint,
  quantity: bigint,
): bigint =>
  roundPositiveDivision(
    inventoryValue * 10n ** BigInt(QUANTITY_SCALE),
    quantity,
  );

const createValuedInventoryMovementRecord = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryMovementData,
): Promise<CreateValuedMovementResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [locationRows] = await connection.execute<LocationRow[]>(
      `
          SELECT
            is_active AS isActive,
            is_inventory_location AS isInventoryLocation
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
      await connection.rollback();
      return { kind: "LOCATION_NOT_FOUND" };
    }

    if (location.isActive === 0) {
      await connection.rollback();
      return { kind: "LOCATION_INACTIVE" };
    }

    if (location.isInventoryLocation === 0) {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_INVENTORY_ENABLED",
      };
    }

    const itemIds = data.lines
      .map((line) => line.inventoryItemId)
      .sort((first, second) => (BigInt(first) < BigInt(second) ? -1 : 1));

    const placeholders = itemIds.map(() => "?").join(", ");

    const [itemRows] = await connection.execute<InventoryItemRow[]>(
      `
          SELECT CAST(id AS CHAR) AS id
          FROM inventory_items
          WHERE
            business_id = ?
            AND id IN (${placeholders})
            AND is_active = TRUE
          ORDER BY id ASC
          FOR UPDATE
        `,
      [businessId, ...itemIds],
    );

    const availableItemIds = new Set(itemRows.map((item) => item.id));

    const unavailableItemIds = itemIds.filter(
      (itemId) => !availableItemIds.has(itemId),
    );

    if (unavailableItemIds.length > 0) {
      await connection.rollback();

      return {
        kind: "ITEMS_NOT_AVAILABLE",
        inventoryItemIds: unavailableItemIds,
      };
    }

    /*
     * Se crea un saldo vacío cuando el artículo todavía no existe
     * en la ubicación. Una salida seguirá fallando por stock
     * insuficiente.
     */
    for (const inventoryItemId of itemIds) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO inventory_location_balances (
            business_id,
            location_id,
            inventory_item_id,
            current_stock,
            minimum_stock,
            average_unit_cost,
            inventory_value,
            valuation_status,
            migrated_from_legacy
          )
          VALUES (
            ?,
            ?,
            ?,
            0.000,
            0.000,
            NULL,
            0.000000,
            'VALUED',
            FALSE
          )
          ON DUPLICATE KEY UPDATE
            inventory_item_id = VALUES(inventory_item_id)
        `,
        [businessId, data.locationId, inventoryItemId],
      );
    }

    const [balanceRows] = await connection.execute<LockedBalanceRow[]>(
      `
          SELECT
            CAST(inventory_item_id AS CHAR)
              AS inventoryItemId,

            CAST(current_stock AS CHAR)
              AS currentStock,

            CAST(average_unit_cost AS CHAR)
              AS averageUnitCost,

            CAST(inventory_value AS CHAR)
              AS inventoryValue,

            valuation_status AS valuationStatus

          FROM inventory_location_balances

          WHERE
            business_id = ?
            AND location_id = ?
            AND inventory_item_id IN (${placeholders})

          ORDER BY inventory_item_id ASC
          FOR UPDATE
        `,
      [businessId, data.locationId, ...itemIds],
    );

    const balanceByItemId = new Map(
      balanceRows.map((balance) => [balance.inventoryItemId, balance]),
    );

    for (const line of data.lines) {
      const balance = balanceByItemId.get(line.inventoryItemId);

      if (!balance) {
        throw new Error("No fue posible recuperar el saldo bloqueado");
      }

      const currentStock = decimalToScaledBigInt(
        balance.currentStock,
        QUANTITY_SCALE,
      );

      const quantity = decimalToScaledBigInt(line.quantity, QUANTITY_SCALE);

      if (currentStock < 0n) {
        await connection.rollback();

        return {
          kind: "NEGATIVE_STOCK",
          inventoryItemId: line.inventoryItemId,
          currentStock: balance.currentStock,
        };
      }

      if (currentStock !== 0n && balance.valuationStatus === "UNVALUED") {
        await connection.rollback();

        return {
          kind: "UNVALUED_STOCK",
          inventoryItemId: line.inventoryItemId,
        };
      }

      if (line.direction === "OUT" && currentStock < quantity) {
        await connection.rollback();

        return {
          kind: "INSUFFICIENT_STOCK",
          inventoryItemId: line.inventoryItemId,
          availableQuantity: balance.currentStock,
          requestedQuantity: line.quantity,
        };
      }

      if (
        line.direction === "IN" &&
        currentStock === 0n &&
        line.unitCost === null
      ) {
        await connection.rollback();

        return {
          kind: "UNIT_COST_REQUIRED",
          inventoryItemId: line.inventoryItemId,
        };
      }

      if (
        line.direction === "IN" &&
        currentStock > 0n &&
        line.unitCost !== null
      ) {
        await connection.rollback();

        return {
          kind: "UNIT_COST_NOT_ALLOWED",
          inventoryItemId: line.inventoryItemId,
        };
      }

      if (
        currentStock > 0n &&
        (balance.averageUnitCost === null || balance.inventoryValue === null)
      ) {
        await connection.rollback();

        return {
          kind: "UNVALUED_STOCK",
          inventoryItemId: line.inventoryItemId,
        };
      }
    }

    const [movementResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO inventory_movements (
            business_id,
            location_id,
            movement_type,
            return_kind,
            source_type,
            source_id,
            external_reference,
            notes,
            created_by_membership_id
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            NULL,
            NULL,
            ?,
            ?,
            ?
          )
        `,
      [
        businessId,
        data.locationId,
        data.movementType,
        data.returnKind,
        data.externalReference,
        data.notes,
        membershipId,
      ],
    );

    const movementId = movementResult.insertId.toString();

    for (const line of data.lines) {
      const balance = balanceByItemId.get(line.inventoryItemId);

      if (!balance) {
        throw new Error("No fue posible recuperar el saldo validado");
      }

      const currentStock = decimalToScaledBigInt(
        balance.currentStock,
        QUANTITY_SCALE,
      );

      const quantity = decimalToScaledBigInt(line.quantity, QUANTITY_SCALE);

      const inventoryValueBefore =
        balance.inventoryValue === null
          ? 0n
          : decimalToScaledBigInt(balance.inventoryValue, COST_SCALE);

      const currentAverageCost =
        balance.averageUnitCost === null
          ? null
          : decimalToScaledBigInt(balance.averageUnitCost, COST_SCALE);

      let usedUnitCost: bigint;
      let totalCost: bigint;
      let stockAfter: bigint;
      let inventoryValueAfter: bigint;
      let averageCostAfter: bigint;

      if (line.direction === "IN") {
        usedUnitCost =
          currentStock === 0n
            ? decimalToScaledBigInt(line.unitCost ?? "0", COST_SCALE)
            : (currentAverageCost ?? 0n);

        totalCost = multiplyQuantityByCost(quantity, usedUnitCost);

        stockAfter = currentStock + quantity;

        inventoryValueAfter = inventoryValueBefore + totalCost;

        averageCostAfter = divideValueByQuantity(
          inventoryValueAfter,
          stockAfter,
        );
      } else {
        if (currentAverageCost === null) {
          throw new Error("No fue posible recuperar el costo promedio");
        }

        usedUnitCost = currentAverageCost;
        stockAfter = currentStock - quantity;

        /*
         * Si sale todo el inventario, se retira exactamente
         * todo el valor restante. Esto evita residuos por redondeo.
         */
        totalCost =
          stockAfter === 0n
            ? inventoryValueBefore
            : multiplyQuantityByCost(quantity, usedUnitCost);

        inventoryValueAfter = inventoryValueBefore - totalCost;

        averageCostAfter = currentAverageCost;
      }

      const balanceBeforeText = scaledBigIntToDecimal(
        currentStock,
        QUANTITY_SCALE,
      );

      const balanceAfterText = scaledBigIntToDecimal(
        stockAfter,
        QUANTITY_SCALE,
      );

      const unitCostText = scaledBigIntToDecimal(usedUnitCost, COST_SCALE);

      const totalCostText = scaledBigIntToDecimal(totalCost, COST_SCALE);

      const inventoryValueBeforeText = scaledBigIntToDecimal(
        inventoryValueBefore,
        COST_SCALE,
      );

      const inventoryValueAfterText = scaledBigIntToDecimal(
        inventoryValueAfter,
        COST_SCALE,
      );

      const averageCostAfterText = scaledBigIntToDecimal(
        averageCostAfter,
        COST_SCALE,
      );

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO inventory_movement_lines (
            business_id,
            movement_id,
            inventory_item_id,
            direction,
            quantity,

            unit_cost,
            total_cost,

            balance_before,
            balance_after,

            average_unit_cost_before,
            average_unit_cost_after,

            inventory_value_before,
            inventory_value_after,

            cost_status,
            notes
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,

            ?,
            ?,

            ?,
            ?,

            ?,
            ?,

            ?,
            ?,

            'VALUED',
            ?
          )
        `,
        [
          businessId,
          movementId,
          line.inventoryItemId,
          line.direction,
          line.quantity,

          unitCostText,
          totalCostText,

          balanceBeforeText,
          balanceAfterText,

          balance.averageUnitCost,
          averageCostAfterText,

          inventoryValueBeforeText,
          inventoryValueAfterText,

          line.notes,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE inventory_location_balances
          SET
            current_stock = ?,
            average_unit_cost = ?,
            inventory_value = ?,
            valuation_status = 'VALUED'
          WHERE
            business_id = ?
            AND location_id = ?
            AND inventory_item_id = ?
        `,
        [
          balanceAfterText,
          averageCostAfterText,
          inventoryValueAfterText,
          businessId,
          data.locationId,
          line.inventoryItemId,
        ],
      );

      /*
       * Compatibilidad temporal con los módulos que todavía
       * consultan inventory_items.current_stock.
       */
      await connection.execute<ResultSetHeader>(
        `
          UPDATE inventory_items
          SET current_stock =
            current_stock
            ${line.direction === "IN" ? "+" : "-"} ?
          WHERE
            business_id = ?
            AND id = ?
        `,
        [line.quantity, businessId, line.inventoryItemId],
      );

      balance.currentStock = balanceAfterText;
      balance.averageUnitCost = averageCostAfterText;
      balance.inventoryValue = inventoryValueAfterText;
      balance.valuationStatus = "VALUED";
    }

    await connection.commit();

    const movement = await findInventoryMovementById(businessId, movementId);

    if (!movement) {
      throw new Error("No fue posible recuperar el movimiento creado");
    }

    return {
      kind: "CREATED",
      movement,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createValuedInventoryMovementRecord };
export type { CreateValuedMovementResult };
