import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { AppError } from "../../../shared/errors/app-error";
import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";
import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";

interface NetInventoryLineRow extends RowDataPacket {
  inventoryItemId: string;
  quantity: string;
  totalCost: string | null;
}

interface PreviousReturnLineRow extends RowDataPacket {
  inventoryItemId: string;
  quantity: string;
  totalCost: string;
}

const QUANTITY_SCALE = 3;
const COST_SCALE = 6;

const restoreSaleRefundInventory = async (
  connection: PoolConnection,
  businessId: string,
  membershipId: string,
  refundId: string,
  refundItemId: string,
  saleItemId: string,
  orderItemId: string,
  locationId: string,
  saleQuantity: number,
  refundQuantity: number,
  reason: string,
): Promise<string | null> => {
  const [netLineRows] = await connection.execute<NetInventoryLineRow[]>(
    `
      SELECT
        movement_lines.inventoryItemId,

        CAST(
          SUM(movement_lines.quantityDelta)
          AS CHAR
        ) AS quantity,

        CASE
          WHEN SUM(movement_lines.unknownCost) = 0
            THEN CAST(
              SUM(movement_lines.costDelta)
              AS CHAR
            )
          ELSE NULL
        END AS totalCost

      FROM (
        SELECT
          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,

          iml.quantity AS quantityDelta,

          CASE
            WHEN iml.total_cost IS NULL THEN 1
            ELSE 0
          END AS unknownCost,

          iml.total_cost AS costDelta

        FROM inventory_movements AS im

        INNER JOIN inventory_movement_lines AS iml
          ON iml.business_id = im.business_id
          AND iml.movement_id = im.id

        WHERE
          im.business_id = ?
          AND im.movement_type = 'SALE'
          AND im.source_type = 'ORDER_ITEM'
          AND im.source_id = ?
          AND iml.direction = 'OUT'

        UNION ALL

        SELECT
          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,

          -iml.quantity AS quantityDelta,

          CASE
            WHEN iml.total_cost IS NULL THEN 1
            ELSE 0
          END AS unknownCost,

          -iml.total_cost AS costDelta

        FROM inventory_movements AS im

        INNER JOIN inventory_movement_lines AS iml
          ON iml.business_id = im.business_id
          AND iml.movement_id = im.id

        WHERE
          im.business_id = ?
          AND im.movement_type = 'REVERSAL'
          AND im.source_type = 'ORDER_ITEM_CANCELLATION'
          AND (
            im.source_id = ?
            OR im.source_id LIKE ?
          )
          AND iml.direction = 'IN'
      ) AS movement_lines

      GROUP BY movement_lines.inventoryItemId

      HAVING SUM(movement_lines.quantityDelta) > 0

      ORDER BY movement_lines.inventoryItemId
    `,
    [businessId, orderItemId, businessId, orderItemId, `${orderItemId}:%`],
  );

  if (netLineRows.length === 0) {
    return null;
  }

  const [previousReturnRows] = await connection.execute<
    PreviousReturnLineRow[]
  >(
    `
        SELECT
          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,

          CAST(SUM(iml.quantity) AS CHAR)
            AS quantity,

          CAST(SUM(iml.total_cost) AS CHAR)
            AS totalCost

        FROM sale_refund_items AS sri

        INNER JOIN inventory_movements AS im
          ON im.business_id = sri.business_id
          AND im.id = sri.inventory_movement_id

        INNER JOIN inventory_movement_lines AS iml
          ON iml.business_id = im.business_id
          AND iml.movement_id = im.id

        WHERE
          sri.business_id = ?
          AND sri.sale_item_id = ?
          AND sri.restore_inventory = TRUE
          AND im.movement_type = 'RETURN'
          AND im.return_kind = 'CUSTOMER_RETURN'
          AND im.source_type = 'SALE_REFUND_ITEM'
          AND iml.direction = 'IN'

        GROUP BY iml.inventory_item_id
      `,
    [businessId, saleItemId],
  );

  const previousReturnByInventoryItemId = new Map(
    previousReturnRows.map((line) => [line.inventoryItemId, line]),
  );

  const lines = netLineRows
    .map((line) => {
      if (line.totalCost === null) {
        throw new AppError(
          `No se conoce el costo histórico del artículo ` +
            `${line.inventoryItemId}`,
          409,
          "INVENTORY_RETURN_COST_NOT_AVAILABLE",
        );
      }

      const originalQuantity = decimalToScaledBigInt(
        line.quantity,
        QUANTITY_SCALE,
      );

      const originalCost = decimalToScaledBigInt(line.totalCost, COST_SCALE);

      const targetQuantity =
        (originalQuantity * BigInt(refundQuantity)) / BigInt(saleQuantity);

      const targetCost =
        (originalCost * BigInt(refundQuantity)) / BigInt(saleQuantity);

      const previousReturn = previousReturnByInventoryItemId.get(
        line.inventoryItemId,
      );

      const previouslyReturnedQuantity =
        previousReturn === undefined
          ? 0n
          : decimalToScaledBigInt(previousReturn.quantity, QUANTITY_SCALE);

      const previouslyReturnedCost =
        previousReturn === undefined
          ? 0n
          : decimalToScaledBigInt(previousReturn.totalCost, COST_SCALE);

      const availableQuantity = originalQuantity - previouslyReturnedQuantity;

      const availableCost = originalCost - previouslyReturnedCost;

      const quantityToReturn =
        targetQuantity > availableQuantity ? availableQuantity : targetQuantity;

      const costToReturn =
        targetCost > availableCost ? availableCost : targetCost;

      if (quantityToReturn <= 0n) {
        return null;
      }

      return {
        inventoryItemId: line.inventoryItemId,
        direction: "IN" as const,
        quantity: scaledBigIntToDecimal(quantityToReturn, QUANTITY_SCALE),
        unitCost: null,
        totalCost: scaledBigIntToDecimal(costToReturn, COST_SCALE),
        notes: `Devolución del producto de venta ${saleItemId}`,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (lines.length === 0) {
    return null;
  }

  const result = await applyLocationInventoryMovement(
    connection,
    businessId,
    membershipId,
    {
      locationId,
      movementType: "RETURN",
      returnKind: "CUSTOMER_RETURN",
      sourceType: "SALE_REFUND_ITEM",
      sourceId: refundItemId,
      externalReference: `REFUND:${refundId}`,
      notes: reason,
      lines,
    },
  );

  switch (result.kind) {
    case "APPLIED":
      return result.movementId;

    case "ITEM_NOT_AVAILABLE":
      throw new AppError(
        `El artículo ${result.inventoryItemId} no está disponible`,
        409,
        "INVENTORY_ITEM_NOT_AVAILABLE",
      );

    case "UNVALUED_STOCK":
      throw new AppError(
        `El artículo ${result.inventoryItemId} tiene stock sin valorar`,
        409,
        "UNVALUED_INVENTORY_STOCK",
      );

    case "UNIT_COST_REQUIRED":
      throw new AppError(
        `No se conoce el costo del artículo ${result.inventoryItemId}`,
        409,
        "INVENTORY_RETURN_COST_REQUIRED",
      );

    case "LOCATION_NOT_FOUND":
    case "LOCATION_INACTIVE":
    case "LOCATION_NOT_INVENTORY_ENABLED":
      throw new AppError(
        "La ubicación de la venta no está disponible para inventario",
        409,
        "INVENTORY_LOCATION_NOT_AVAILABLE",
      );

    case "INSUFFICIENT_STOCK":
      throw new Error(
        "Una devolución de inventario produjo stock insuficiente",
      );
  }
};

export { restoreSaleRefundInventory };
