import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

type LedgerDirection = "IN" | "OUT";

type LedgerMovementType =
  | "SALE"
  | "REVERSAL"
  | "PRODUCTION"
  | "OPENING"
  | "ADJUSTMENT"
  | "WASTE"
  | "RETURN";

type LedgerReturnKind = "CUSTOMER_RETURN" | "SUPPLIER_RETURN" | null;

type LocationInventoryLedgerLine = Readonly<{
  inventoryItemId: string;
  direction: LedgerDirection;
  quantity: string;

  /**
   * Costo unitario histórico o explícito de una entrada.
   */
  unitCost: string | null;

  /**
   * Costo total histórico.
   *
   * Se usa en reversiones para restituir exactamente el valor
   * retirado, evitando diferencias por redondeo.
   */
  totalCost?: string | null;

  notes: string | null;
}>;

type ApplyLocationInventoryMovementData = Readonly<{
  locationId: string;
  movementType: LedgerMovementType;
  returnKind: LedgerReturnKind;
  sourceType: string | null;
  sourceId: string | null;
  externalReference: string | null;
  notes: string;
  lines: readonly LocationInventoryLedgerLine[];
}>;

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

type ApplyLocationInventoryMovementResult =
  | Readonly<{
      kind: "APPLIED";
      movementId: string;
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
      kind: "ITEM_NOT_AVAILABLE";
      inventoryItemId: string;
    }>
  | Readonly<{
      kind: "UNVALUED_STOCK";
      inventoryItemId: string;
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
    }>;

const QUANTITY_SCALE = 3;
const COST_SCALE = 6;

const roundPositiveDivision = (
  numerator: bigint,
  denominator: bigint,
): bigint => {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error("La división decimal recibió valores inválidos");
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

/**
 * Aplica un movimiento dentro de una transacción ya iniciada.
 *
 * Esta función no ejecuta beginTransaction, commit ni rollback.
 * El repositorio que la invoque conserva el control de la transacción.
 */
const applyLocationInventoryMovement = async (
  connection: PoolConnection,
  businessId: string,
  membershipId: string,
  data: ApplyLocationInventoryMovementData,
): Promise<ApplyLocationInventoryMovementResult> => {
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
    return { kind: "LOCATION_NOT_FOUND" };
  }

  if (location.isActive !== 1) {
    return { kind: "LOCATION_INACTIVE" };
  }

  if (location.isInventoryLocation !== 1) {
    return { kind: "LOCATION_NOT_INVENTORY_ENABLED" };
  }

  const inventoryItemIds = [
    ...new Set(data.lines.map((line) => line.inventoryItemId)),
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

  if (inventoryItemIds.length === 0) {
    throw new Error("El movimiento debe contener al menos una línea");
  }

  const placeholders = inventoryItemIds.map(() => "?").join(", ");

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
    [businessId, ...inventoryItemIds],
  );

  const availableItemIds = new Set(itemRows.map((item) => item.id));

  for (const inventoryItemId of inventoryItemIds) {
    if (!availableItemIds.has(inventoryItemId)) {
      return {
        kind: "ITEM_NOT_AVAILABLE",
        inventoryItemId,
      };
    }
  }

  /*
   * Crea el saldo vacío si el artículo todavía no existe en la sede.
   * Una salida posterior fallará con INSUFFICIENT_STOCK.
   */
  for (const inventoryItemId of inventoryItemIds) {
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
        CAST(inventory_item_id AS CHAR) AS inventoryItemId,
        CAST(current_stock AS CHAR) AS currentStock,
        CAST(average_unit_cost AS CHAR) AS averageUnitCost,
        CAST(inventory_value AS CHAR) AS inventoryValue,
        valuation_status AS valuationStatus
      FROM inventory_location_balances
      WHERE
        business_id = ?
        AND location_id = ?
        AND inventory_item_id IN (${placeholders})
      ORDER BY inventory_item_id ASC
      FOR UPDATE
    `,
    [businessId, data.locationId, ...inventoryItemIds],
  );

  const balanceByInventoryItemId = new Map(
    balanceRows.map((balance) => [balance.inventoryItemId, balance]),
  );

  /*
   * Validamos todas las líneas antes de insertar el movimiento.
   */
  for (const line of data.lines) {
    const balance = balanceByInventoryItemId.get(line.inventoryItemId);

    if (!balance) {
      throw new Error("No fue posible recuperar el saldo bloqueado");
    }

    const currentStock = decimalToScaledBigInt(
      balance.currentStock,
      QUANTITY_SCALE,
    );

    const quantity = decimalToScaledBigInt(line.quantity, QUANTITY_SCALE);

    if (
      currentStock > 0n &&
      (balance.valuationStatus !== "VALUED" ||
        balance.averageUnitCost === null ||
        balance.inventoryValue === null)
    ) {
      return {
        kind: "UNVALUED_STOCK",
        inventoryItemId: line.inventoryItemId,
      };
    }

    if (line.direction === "OUT" && currentStock < quantity) {
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
      line.unitCost === null &&
      line.totalCost == null
    ) {
      return {
        kind: "UNIT_COST_REQUIRED",
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      businessId,
      data.locationId,
      data.movementType,
      data.returnKind,
      data.sourceType,
      data.sourceId,
      data.externalReference,
      data.notes,
      membershipId,
    ],
  );

  const movementId = movementResult.insertId.toString();

  for (const line of data.lines) {
    const balance = balanceByInventoryItemId.get(line.inventoryItemId);

    if (!balance) {
      throw new Error("No fue posible recuperar el saldo validado");
    }

    const stockBefore = decimalToScaledBigInt(
      balance.currentStock,
      QUANTITY_SCALE,
    );

    const quantity = decimalToScaledBigInt(line.quantity, QUANTITY_SCALE);

    const valueBefore =
      balance.inventoryValue === null
        ? 0n
        : decimalToScaledBigInt(balance.inventoryValue, COST_SCALE);

    const averageCostBefore =
      balance.averageUnitCost === null
        ? null
        : decimalToScaledBigInt(balance.averageUnitCost, COST_SCALE);

    let stockAfter: bigint;
    let valueAfter: bigint;
    let averageCostAfter: bigint | null;
    let appliedUnitCost: bigint;
    let totalCost: bigint;

    if (line.direction === "OUT") {
      if (averageCostBefore === null) {
        throw new Error(
          "No fue posible recuperar el costo promedio de la salida",
        );
      }

      stockAfter = stockBefore - quantity;
      appliedUnitCost = averageCostBefore;

      /*
       * Si se consume todo, retiramos exactamente todo el valor.
       * Así evitamos residuos económicos por redondeo.
       */
      totalCost =
        stockAfter === 0n
          ? valueBefore
          : multiplyQuantityByCost(quantity, appliedUnitCost);

      valueAfter = valueBefore - totalCost;

      /*
       * La restricción de la base exige costo promedio NULL cuando
       * el saldo físico queda en cero.
       */
      averageCostAfter = stockAfter === 0n ? null : averageCostBefore;
    } else {
      const explicitTotalCost =
        line.totalCost == null
          ? null
          : decimalToScaledBigInt(line.totalCost, COST_SCALE);

      if (line.unitCost !== null) {
        appliedUnitCost = decimalToScaledBigInt(line.unitCost, COST_SCALE);
      } else if (explicitTotalCost !== null) {
        appliedUnitCost = divideValueByQuantity(explicitTotalCost, quantity);
      } else if (averageCostBefore !== null) {
        appliedUnitCost = averageCostBefore;
      } else {
        throw new Error("No fue posible determinar el costo de la entrada");
      }

      totalCost =
        explicitTotalCost ?? multiplyQuantityByCost(quantity, appliedUnitCost);

      stockAfter = stockBefore + quantity;
      valueAfter = valueBefore + totalCost;

      averageCostAfter = divideValueByQuantity(valueAfter, stockAfter);
    }

    const stockBeforeText = scaledBigIntToDecimal(stockBefore, QUANTITY_SCALE);

    const stockAfterText = scaledBigIntToDecimal(stockAfter, QUANTITY_SCALE);

    const unitCostText = scaledBigIntToDecimal(appliedUnitCost, COST_SCALE);

    const totalCostText = scaledBigIntToDecimal(totalCost, COST_SCALE);

    const valueBeforeText = scaledBigIntToDecimal(valueBefore, COST_SCALE);

    const valueAfterText = scaledBigIntToDecimal(valueAfter, COST_SCALE);

    const averageCostAfterText =
      averageCostAfter === null
        ? null
        : scaledBigIntToDecimal(averageCostAfter, COST_SCALE);

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
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALUED', ?
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
        stockBeforeText,
        stockAfterText,
        balance.averageUnitCost,
        averageCostAfterText,
        valueBeforeText,
        valueAfterText,
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
        stockAfterText,
        averageCostAfterText,
        valueAfterText,
        businessId,
        data.locationId,
        line.inventoryItemId,
      ],
    );

    /*
     * Compatibilidad temporal.
     *
     * El valor global siempre se modifica por diferencia, nunca se
     * reemplaza con el saldo de una única ubicación.
     */
    await connection.execute<ResultSetHeader>(
      `
        UPDATE inventory_items
        SET current_stock =
          current_stock ${line.direction === "IN" ? "+" : "-"} ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [line.quantity, businessId, line.inventoryItemId],
    );

    balance.currentStock = stockAfterText;
    balance.averageUnitCost = averageCostAfterText;
    balance.inventoryValue = valueAfterText;
    balance.valuationStatus = "VALUED";
  }

  return {
    kind: "APPLIED",
    movementId,
  };
};

export { applyLocationInventoryMovement };

export type {
  ApplyLocationInventoryMovementData,
  ApplyLocationInventoryMovementResult,
  LocationInventoryLedgerLine,
};
