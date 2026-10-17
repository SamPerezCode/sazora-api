import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { AppError } from "../../../shared/errors/app-error";

import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";

import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";

type MovementRow = RowDataPacket & {
  id: string;
};

type SaleMovementRow = RowDataPacket & {
  id: string;
  locationId: string | null;
};

type SaleMovementLineRow = RowDataPacket & {
  inventoryItemId: string;
  quantity: string;
  unitCost: string | null;
  totalCost: string | null;
};

type ReversedMovementLineRow = RowDataPacket & {
  inventoryItemId: string;
  quantity: string;
  totalCost: string | null;
};

type ReverseOrderItemInventoryResult =
  | Readonly<{
      kind: "REVERSED";
      movementId: string;
    }>
  | Readonly<{
      kind: "NO_INVENTORY_MOVEMENT";
    }>
  | Readonly<{
      kind: "ALREADY_REVERSED";
      movementId: string;
    }>;

const QUANTITY_SCALE = 3;
const COST_SCALE = 6;

const reverseOrderItemInventory = async (
  connection: PoolConnection,
  businessId: string,
  membershipId: string,
  orderId: string,
  orderItemId: string,
  reason: string,
): Promise<ReverseOrderItemInventoryResult> => {
  /*
   * Una reversión con source_id exacto representa la cancelación
   * completa. Las parciales usan source_id con sufijos.
   */
  const [existingCompleteReversalRows] = await connection.execute<
    MovementRow[]
  >(
    `
        SELECT CAST(id AS CHAR) AS id
        FROM inventory_movements
        WHERE
          business_id = ?
          AND movement_type = 'REVERSAL'
          AND source_type = 'ORDER_ITEM_CANCELLATION'
          AND source_id = ?
        LIMIT 1
      `,
    [businessId, orderItemId],
  );

  const existingCompleteReversal = existingCompleteReversalRows[0];

  if (existingCompleteReversal) {
    return {
      kind: "ALREADY_REVERSED",
      movementId: existingCompleteReversal.id,
    };
  }

  /*
   * Si la venta es anterior a la migración por ubicación,
   * utilizamos como respaldo la ubicación de la orden.
   */
  const [saleMovementRows] = await connection.execute<SaleMovementRow[]>(
    `
        SELECT
          CAST(im.id AS CHAR) AS id,

          CAST(
            COALESCE(
              im.location_id,
              o.location_id
            )
            AS CHAR
          ) AS locationId

        FROM inventory_movements AS im

        LEFT JOIN order_items AS oi
          ON oi.business_id = im.business_id
          AND CAST(oi.id AS CHAR) = im.source_id

        LEFT JOIN orders AS o
          ON o.business_id = oi.business_id
          AND o.id = oi.order_id

        WHERE
          im.business_id = ?
          AND im.movement_type = 'SALE'
          AND im.source_type = 'ORDER_ITEM'
          AND im.source_id = ?

        LIMIT 1
      `,
    [businessId, orderItemId],
  );

  const saleMovement = saleMovementRows[0];

  if (!saleMovement) {
    return {
      kind: "NO_INVENTORY_MOVEMENT",
    };
  }

  if (!saleMovement.locationId) {
    throw new AppError(
      "No fue posible determinar la ubicación de la venta",
      409,
      "INVENTORY_SALE_LOCATION_NOT_AVAILABLE",
    );
  }

  /*
   * Agrupamos por artículo porque el motor del libro recibe una
   * sola cantidad neta por artículo.
   */
  const [saleLineRows] = await connection.execute<SaleMovementLineRow[]>(
    `
        SELECT
          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,

          CAST(SUM(iml.quantity) AS CHAR)
            AS quantity,

          CASE
            WHEN COUNT(iml.unit_cost) = COUNT(*)
              THEN CAST(
                SUM(iml.total_cost) / SUM(iml.quantity)
                AS CHAR
              )
            ELSE NULL
          END AS unitCost,

          CASE
            WHEN COUNT(iml.total_cost) = COUNT(*)
              THEN CAST(SUM(iml.total_cost) AS CHAR)
            ELSE NULL
          END AS totalCost

        FROM inventory_movement_lines AS iml

        WHERE
          iml.business_id = ?
          AND iml.movement_id = ?
          AND iml.direction = 'OUT'

        GROUP BY iml.inventory_item_id

        ORDER BY iml.inventory_item_id ASC
      `,
    [businessId, saleMovement.id],
  );

  if (saleLineRows.length === 0) {
    return {
      kind: "NO_INVENTORY_MOVEMENT",
    };
  }

  /*
   * Restamos las devoluciones parciales anteriores.
   *
   * De esta forma, si primero se canceló una parte y luego se
   * cancela completamente el producto, solo se devuelve el saldo
   * que todavía permanecía consumido.
   */
  const [reversedLineRows] = await connection.execute<
    ReversedMovementLineRow[]
  >(
    `
        SELECT
          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,

          CAST(SUM(iml.quantity) AS CHAR)
            AS quantity,

          CASE
            WHEN COUNT(iml.total_cost) = COUNT(*)
              THEN CAST(SUM(iml.total_cost) AS CHAR)
            ELSE NULL
          END AS totalCost

        FROM inventory_movements AS im

        INNER JOIN inventory_movement_lines AS iml
          ON iml.business_id = im.business_id
          AND iml.movement_id = im.id

        WHERE
          im.business_id = ?
          AND im.movement_type = 'REVERSAL'
          AND im.source_type = 'ORDER_ITEM_CANCELLATION'
          AND im.source_id LIKE ?
          AND iml.direction = 'IN'

        GROUP BY iml.inventory_item_id
      `,
    [businessId, `${orderItemId}:%`],
  );

  const reversedByInventoryItemId = new Map(
    reversedLineRows.map((line) => [line.inventoryItemId, line]),
  );

  const remainingLines = saleLineRows
    .map((saleLine) => {
      const soldQuantity = decimalToScaledBigInt(
        saleLine.quantity,
        QUANTITY_SCALE,
      );

      const previousReversal = reversedByInventoryItemId.get(
        saleLine.inventoryItemId,
      );

      const reversedQuantity =
        previousReversal === undefined
          ? 0n
          : decimalToScaledBigInt(previousReversal.quantity, QUANTITY_SCALE);

      const remainingQuantity = soldQuantity - reversedQuantity;

      if (remainingQuantity <= 0n) {
        return null;
      }

      const soldTotalCost =
        saleLine.totalCost === null
          ? null
          : decimalToScaledBigInt(saleLine.totalCost, COST_SCALE);

      const previousReversalHasUnknownCost =
        previousReversal?.totalCost === null;

      const reversedTotalCost =
        previousReversal?.totalCost == null
          ? 0n
          : decimalToScaledBigInt(previousReversal.totalCost, COST_SCALE);

      const remainingTotalCost =
        soldTotalCost === null || previousReversalHasUnknownCost
          ? null
          : soldTotalCost - reversedTotalCost;

      if (remainingTotalCost !== null && remainingTotalCost < 0n) {
        throw new Error("El costo revertido supera el costo de la venta");
      }

      return {
        inventoryItemId: saleLine.inventoryItemId,

        direction: "IN" as const,

        quantity: scaledBigIntToDecimal(remainingQuantity, QUANTITY_SCALE),

        unitCost: saleLine.unitCost,

        totalCost:
          remainingTotalCost === null
            ? null
            : scaledBigIntToDecimal(remainingTotalCost, COST_SCALE),

        notes: `Reversión por cancelación del producto ` + `${orderItemId}`,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (remainingLines.length === 0) {
    const [lastReversalRows] = await connection.execute<MovementRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
        FROM inventory_movements
        WHERE
          business_id = ?
          AND movement_type = 'REVERSAL'
          AND source_type = 'ORDER_ITEM_CANCELLATION'
          AND (
            source_id = ?
            OR source_id LIKE ?
          )
        ORDER BY id DESC
        LIMIT 1
      `,
      [businessId, orderItemId, `${orderItemId}:%`],
    );

    return {
      kind: "ALREADY_REVERSED",
      movementId: lastReversalRows[0]?.id ?? saleMovement.id,
    };
  }

  const reversalResult = await applyLocationInventoryMovement(
    connection,
    businessId,
    membershipId,
    {
      locationId: saleMovement.locationId,
      movementType: "REVERSAL",
      returnKind: null,
      sourceType: "ORDER_ITEM_CANCELLATION",
      sourceId: orderItemId,
      externalReference: `ORDER:${orderId}`,
      notes:
        `Devolución del producto ${orderItemId} ` +
        `de la orden ${orderId}: ${reason}`,
      lines: remainingLines,
    },
  );

  switch (reversalResult.kind) {
    case "APPLIED":
      return {
        kind: "REVERSED",
        movementId: reversalResult.movementId,
      };

    case "ITEM_NOT_AVAILABLE":
      throw new AppError(
        `El artículo ${reversalResult.inventoryItemId} ` +
          "ya no está disponible",
        409,
        "INVENTORY_ITEM_NOT_AVAILABLE",
      );

    case "UNVALUED_STOCK":
      throw new AppError(
        `El artículo ${reversalResult.inventoryItemId} ` +
          "tiene existencias sin valorar",
        409,
        "UNVALUED_INVENTORY_STOCK",
      );

    case "UNIT_COST_REQUIRED":
      throw new AppError(
        `No se conoce el costo histórico del artículo ` +
          `${reversalResult.inventoryItemId}`,
        409,
        "INVENTORY_REVERSAL_COST_REQUIRED",
      );

    case "LOCATION_NOT_FOUND":
    case "LOCATION_INACTIVE":
    case "LOCATION_NOT_INVENTORY_ENABLED":
      throw new AppError(
        "La ubicación original de la venta no está disponible",
        409,
        "INVENTORY_LOCATION_NOT_AVAILABLE",
      );

    case "INSUFFICIENT_STOCK":
      /*
       * Una reversión es una entrada; este resultado indicaría
       * una inconsistencia interna.
       */
      throw new Error("Una reversión de inventario produjo stock insuficiente");
  }
};

export { reverseOrderItemInventory };
export type { ReverseOrderItemInventoryResult };
