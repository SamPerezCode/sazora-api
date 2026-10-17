import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";

type InventoryRequirementRow = RowDataPacket & {
  orderItemId: string;
  inventoryItemId: string;
  requiredQuantity: string;
};

type ExistingMovementRow = RowDataPacket & {
  id: string;
  sourceId: string;
};

type DeductOrderInventoryResult =
  | Readonly<{
      kind: "DEDUCTED";
      movementIds: readonly string[];
    }>
  | Readonly<{
      kind: "NO_LINKED_INVENTORY";
    }>
  | Readonly<{
      kind: "ALREADY_DEDUCTED";
      movementIds: readonly string[];
    }>
  | Readonly<{
      kind: "INVENTORY_ITEM_NOT_AVAILABLE";
      inventoryItemId: string;
    }>
  | Readonly<{
      kind: "INSUFFICIENT_INVENTORY_STOCK";
      inventoryItemId: string;
      availableQuantity: string;
      requestedQuantity: string;
    }>
  | Readonly<{
      kind: "UNVALUED_INVENTORY_STOCK";
      inventoryItemId: string;
    }>
  | Readonly<{
      kind: "INVENTORY_LOCATION_NOT_AVAILABLE";
      locationId: string;
    }>;

const deductOrderInventory = async (
  connection: PoolConnection,
  businessId: string,
  membershipId: string,
  orderId: string,
  locationId: string,
  includedOrderItemIds?: readonly string[],
): Promise<DeductOrderInventoryResult> => {
  const includedItemFilter = includedOrderItemIds?.length
    ? `AND oi.id IN (${includedOrderItemIds.map(() => "?").join(", ")})`
    : "";

  const [requirementRows] = await connection.execute<InventoryRequirementRow[]>(
    `
        SELECT
          CAST(oi.id AS CHAR) AS orderItemId,

          CAST(pil.inventory_item_id AS CHAR)
            AS inventoryItemId,

          CAST(
            oi.quantity * pil.quantity_per_product
            AS CHAR
          ) AS requiredQuantity

        FROM order_items AS oi

        INNER JOIN product_inventory_links AS pil
          ON pil.business_id = oi.business_id
          AND pil.product_id = oi.product_id
          AND pil.is_active = TRUE
          AND pil.auto_deduct = TRUE

        WHERE
          oi.business_id = ?
          AND oi.order_id = ?
          AND oi.status = 'ACTIVE'
          ${includedItemFilter}

        ORDER BY
          oi.id ASC,
          pil.inventory_item_id ASC
      `,
    [businessId, orderId, ...(includedOrderItemIds ?? [])],
  );

  if (requirementRows.length === 0) {
    return {
      kind: "NO_LINKED_INVENTORY",
    };
  }

  const orderItemIds = [
    ...new Set(requirementRows.map((requirement) => requirement.orderItemId)),
  ];

  const orderItemPlaceholders = orderItemIds.map(() => "?").join(", ");

  const [existingMovementRows] = await connection.execute<
    ExistingMovementRow[]
  >(
    `
        SELECT
          CAST(id AS CHAR) AS id,
          source_id AS sourceId

        FROM inventory_movements

        WHERE
          business_id = ?
          AND movement_type = 'SALE'
          AND source_type = 'ORDER_ITEM'
          AND source_id IN (${orderItemPlaceholders})

        ORDER BY id ASC
      `,
    [businessId, ...orderItemIds],
  );

  if (existingMovementRows.length === orderItemIds.length) {
    return {
      kind: "ALREADY_DEDUCTED",
      movementIds: existingMovementRows.map((movement) => movement.id),
    };
  }

  const existingMovementByOrderItemId = new Map(
    existingMovementRows.map((movement) => [movement.sourceId, movement.id]),
  );

  const requirementsByOrderItem = new Map<string, InventoryRequirementRow[]>();

  for (const requirement of requirementRows) {
    const requirements =
      requirementsByOrderItem.get(requirement.orderItemId) ?? [];

    requirements.push(requirement);

    requirementsByOrderItem.set(requirement.orderItemId, requirements);
  }

  const movementIds: string[] = [];

  for (const [orderItemId, requirements] of requirementsByOrderItem) {
    const existingMovementId = existingMovementByOrderItemId.get(orderItemId);

    if (existingMovementId) {
      movementIds.push(existingMovementId);
      continue;
    }

    const movementResult = await applyLocationInventoryMovement(
      connection,
      businessId,
      membershipId,
      {
        locationId,
        movementType: "SALE",
        returnKind: null,
        sourceType: "ORDER_ITEM",
        sourceId: orderItemId,
        externalReference: `ORDER:${orderId}`,
        notes:
          `Descuento automático del producto ${orderItemId} ` +
          `de la orden ${orderId}`,
        lines: requirements.map((requirement) => ({
          inventoryItemId: requirement.inventoryItemId,
          direction: "OUT" as const,
          quantity: requirement.requiredQuantity,
          unitCost: null,
          notes: `Venta del producto ${orderItemId}`,
        })),
      },
    );

    switch (movementResult.kind) {
      case "APPLIED":
        movementIds.push(movementResult.movementId);
        break;

      case "ITEM_NOT_AVAILABLE":
        return {
          kind: "INVENTORY_ITEM_NOT_AVAILABLE",
          inventoryItemId: movementResult.inventoryItemId,
        };

      case "INSUFFICIENT_STOCK":
        return {
          kind: "INSUFFICIENT_INVENTORY_STOCK",
          inventoryItemId: movementResult.inventoryItemId,
          availableQuantity: movementResult.availableQuantity,
          requestedQuantity: movementResult.requestedQuantity,
        };

      case "UNVALUED_STOCK":
      case "UNIT_COST_REQUIRED":
        return {
          kind: "UNVALUED_INVENTORY_STOCK",
          inventoryItemId: movementResult.inventoryItemId,
        };

      case "LOCATION_NOT_FOUND":
      case "LOCATION_INACTIVE":
      case "LOCATION_NOT_INVENTORY_ENABLED":
        return {
          kind: "INVENTORY_LOCATION_NOT_AVAILABLE",
          locationId,
        };
    }
  }

  return {
    kind: "DEDUCTED",
    movementIds,
  };
};

export { deductOrderInventory };
export type { DeductOrderInventoryResult };
