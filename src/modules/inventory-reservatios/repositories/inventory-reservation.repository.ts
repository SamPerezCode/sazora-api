import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import type {
  InventoryReservation,
  InventoryReservationStatus,
  ReserveOrderItemInventoryData,
  ReserveOrderItemInventoryResult,
} from "../inventory-reservation.types";

interface ReservationRow extends RowDataPacket {
  id: string;
  businessId: string;
  locationId: string;
  orderId: string;
  orderItemId: string;
  inventoryItemId: string;
  quantity: string;
  status: InventoryReservationStatus;
  expiresAt: Date | null;
  reservedAt: Date;
  consumedAt: Date | null;
  releasedAt: Date | null;
  releaseReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ReservationDemandRow extends RowDataPacket {
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemActive: number;
  requestedQuantity: string;
}

interface InventoryBalanceRow extends RowDataPacket {
  inventoryItemId: string;
  currentStock: string;
}

interface ReservedQuantityRow extends RowDataPacket {
  inventoryItemId: string;
  reservedQuantity: string;
}

interface ExistingReservationStateRow extends RowDataPacket {
  inventoryItemId: string;
  status: InventoryReservationStatus;
}

const reservationSelect = `
  SELECT
    CAST(ir.id AS CHAR) AS id,
    CAST(ir.business_id AS CHAR) AS businessId,
    CAST(ir.location_id AS CHAR) AS locationId,
    CAST(ir.order_id AS CHAR) AS orderId,
    CAST(ir.order_item_id AS CHAR) AS orderItemId,
    CAST(ir.inventory_item_id AS CHAR) AS inventoryItemId,
    CAST(ir.quantity AS CHAR) AS quantity,
    ir.status,
    ir.expires_at AS expiresAt,
    ir.reserved_at AS reservedAt,
    ir.consumed_at AS consumedAt,
    ir.released_at AS releasedAt,
    ir.release_reason AS releaseReason,
    ir.created_at AS createdAt,
    ir.updated_at AS updatedAt
  FROM inventory_reservations AS ir
`;

const mapReservationRow = (row: ReservationRow): InventoryReservation => ({
  id: row.id,
  businessId: row.businessId,
  locationId: row.locationId,
  orderId: row.orderId,
  orderItemId: row.orderItemId,
  inventoryItemId: row.inventoryItemId,
  quantity: row.quantity,
  status: row.status,
  expiresAt: row.expiresAt,
  reservedAt: row.reservedAt,
  consumedAt: row.consumedAt,
  releasedAt: row.releasedAt,
  releaseReason: row.releaseReason,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const parseQuantity = (value: string): bigint => {
  const match = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());

  if (!match) {
    throw new Error(`Cantidad de inventario no válida: ${value}`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2] ?? "0";
  const fraction = (match[3] ?? "").padEnd(3, "0");

  return sign * (BigInt(whole) * 1000n + BigInt(fraction || "0"));
};

const formatQuantity = (value: bigint): string => {
  const isNegative = value < 0n;
  const absolute = isNegative ? -value : value;

  const whole = absolute / 1000n;
  const fraction = (absolute % 1000n).toString().padStart(3, "0");

  return `${isNegative ? "-" : ""}${whole.toString()}.${fraction}`;
};

const findOrderItemReservations = async (
  connection: PoolConnection,
  businessId: string,
  orderItemId: string,
): Promise<InventoryReservation[]> => {
  const [rows] = await connection.execute<ReservationRow[]>(
    `
      ${reservationSelect}
      WHERE
        ir.business_id = ?
        AND ir.order_item_id = ?
      ORDER BY ir.id ASC
    `,
    [businessId, orderItemId],
  );

  return rows.map(mapReservationRow);
};

const findActiveOrderReservations = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
): Promise<InventoryReservation[]> => {
  const [rows] = await connection.execute<ReservationRow[]>(
    `
      ${reservationSelect}
      WHERE
        ir.business_id = ?
        AND ir.order_id = ?
        AND ir.status = 'ACTIVE'
      ORDER BY
        ir.inventory_item_id ASC,
        ir.id ASC
    `,
    [businessId, orderId],
  );

  return rows.map(mapReservationRow);
};

const reserveOrderItemInventory = async (
  connection: PoolConnection,
  businessId: string,
  data: ReserveOrderItemInventoryData,
): Promise<ReserveOrderItemInventoryResult> => {
  const [demandRows] = await connection.execute<ReservationDemandRow[]>(
    `
      SELECT
        CAST(pil.inventory_item_id AS CHAR) AS inventoryItemId,
        ii.name AS inventoryItemName,
        ii.is_active AS inventoryItemActive,
        CAST(
          pil.quantity_per_product * ?
          AS CHAR
        ) AS requestedQuantity
      FROM product_inventory_links AS pil
      INNER JOIN inventory_items AS ii
        ON ii.business_id = pil.business_id
        AND ii.id = pil.inventory_item_id
      WHERE
        pil.business_id = ?
        AND pil.product_id = ?
        AND pil.is_active = TRUE
        AND pil.auto_deduct = TRUE
      ORDER BY pil.inventory_item_id ASC
    `,
    [data.orderQuantity, businessId, data.productId],
  );

  const [existingStateRows] = await connection.execute<
    ExistingReservationStateRow[]
  >(
    `
        SELECT
          CAST(inventory_item_id AS CHAR) AS inventoryItemId,
          status
        FROM inventory_reservations
        WHERE
          business_id = ?
          AND order_item_id = ?
        ORDER BY inventory_item_id ASC
        FOR UPDATE
      `,
    [businessId, data.orderItemId],
  );

  const consumedReservation = existingStateRows.find(
    (reservation) => reservation.status === "CONSUMED",
  );

  if (consumedReservation) {
    return {
      kind: "RESERVATION_ALREADY_CONSUMED",
      inventoryItemId: consumedReservation.inventoryItemId,
    };
  }

  if (demandRows.length === 0) {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE inventory_reservations
        SET
          status = 'RELEASED',
          consumed_at = NULL,
          released_at = CURRENT_TIMESTAMP(3),
          release_reason = 'Producto sin consumo automático vigente'
        WHERE
          business_id = ?
          AND order_item_id = ?
          AND status = 'ACTIVE'
      `,
      [businessId, data.orderItemId],
    );

    return {
      kind: "RESERVED",
      reservations: [],
    };
  }

  const inactiveItem = demandRows.find((demand) => !demand.inventoryItemActive);

  if (inactiveItem) {
    return {
      kind: "INVENTORY_ITEM_UNAVAILABLE",
      inventoryItemId: inactiveItem.inventoryItemId,
      inventoryItemName: inactiveItem.inventoryItemName,
    };
  }

  const inventoryItemIds = demandRows.map((demand) => demand.inventoryItemId);

  const placeholders = inventoryItemIds.map(() => "?").join(", ");

  const [balanceRows] = await connection.execute<InventoryBalanceRow[]>(
    `
      SELECT
        CAST(inventory_item_id AS CHAR) AS inventoryItemId,
        CAST(current_stock AS CHAR) AS currentStock
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

  const balanceByItemId = new Map(
    balanceRows.map((balance) => [
      balance.inventoryItemId,
      balance.currentStock,
    ]),
  );

  const [reservedRows] = await connection.execute<ReservedQuantityRow[]>(
    `
      SELECT
        CAST(inventory_item_id AS CHAR) AS inventoryItemId,
        CAST(COALESCE(SUM(quantity), 0) AS CHAR) AS reservedQuantity
      FROM inventory_reservations
      WHERE
        business_id = ?
        AND location_id = ?
        AND status = 'ACTIVE'
        AND order_item_id <> ?
        AND inventory_item_id IN (${placeholders})
      GROUP BY inventory_item_id
      ORDER BY inventory_item_id ASC
    `,
    [businessId, data.locationId, data.orderItemId, ...inventoryItemIds],
  );

  const reservedByItemId = new Map(
    reservedRows.map((reservation) => [
      reservation.inventoryItemId,
      reservation.reservedQuantity,
    ]),
  );

  for (const demand of demandRows) {
    const currentStock = balanceByItemId.get(demand.inventoryItemId) ?? "0.000";
    const reservedQuantity =
      reservedByItemId.get(demand.inventoryItemId) ?? "0.000";

    const availableQuantity =
      parseQuantity(currentStock) - parseQuantity(reservedQuantity);

    const requestedQuantity = parseQuantity(demand.requestedQuantity);

    if (requestedQuantity > availableQuantity) {
      return {
        kind: "INSUFFICIENT_AVAILABLE_STOCK",
        inventoryItemId: demand.inventoryItemId,
        inventoryItemName: demand.inventoryItemName,
        currentStock,
        reservedQuantity,
        availableQuantity: formatQuantity(
          availableQuantity > 0n ? availableQuantity : 0n,
        ),
        requestedQuantity: formatQuantity(requestedQuantity),
      };
    }
  }

  for (const demand of demandRows) {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO inventory_reservations (
          business_id,
          location_id,
          order_id,
          order_item_id,
          inventory_item_id,
          quantity,
          status,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
        ON DUPLICATE KEY UPDATE
          location_id = ?,
          order_id = ?,
          quantity = ?,
          status = 'ACTIVE',
          expires_at = ?,
          reserved_at = CURRENT_TIMESTAMP(3),
          consumed_at = NULL,
          released_at = NULL,
          release_reason = NULL
      `,
      [
        businessId,
        data.locationId,
        data.orderId,
        data.orderItemId,
        demand.inventoryItemId,
        demand.requestedQuantity,
        data.expiresAt,
        data.locationId,
        data.orderId,
        demand.requestedQuantity,
        data.expiresAt,
      ],
    );
  }

  const currentInventoryItemIds = new Set(inventoryItemIds);

  const reservationsToRelease = existingStateRows
    .filter(
      (reservation) =>
        reservation.status === "ACTIVE" &&
        !currentInventoryItemIds.has(reservation.inventoryItemId),
    )
    .map((reservation) => reservation.inventoryItemId);

  if (reservationsToRelease.length > 0) {
    const releasePlaceholders = reservationsToRelease.map(() => "?").join(", ");

    await connection.execute<ResultSetHeader>(
      `
        UPDATE inventory_reservations
        SET
          status = 'RELEASED',
          consumed_at = NULL,
          released_at = CURRENT_TIMESTAMP(3),
          release_reason = 'Vínculo de inventario retirado del producto'
        WHERE
          business_id = ?
          AND order_item_id = ?
          AND status = 'ACTIVE'
          AND inventory_item_id IN (${releasePlaceholders})
      `,
      [businessId, data.orderItemId, ...reservationsToRelease],
    );
  }

  const reservations = await findOrderItemReservations(
    connection,
    businessId,
    data.orderItemId,
  );

  return {
    kind: "RESERVED",
    reservations: reservations.filter(
      (reservation) => reservation.status === "ACTIVE",
    ),
  };
};

const releaseOrderItemReservations = async (
  connection: PoolConnection,
  businessId: string,
  orderItemId: string,
  reason: string,
): Promise<number> => {
  const [result] = await connection.execute<ResultSetHeader>(
    `
      UPDATE inventory_reservations
      SET
        status = 'RELEASED',
        consumed_at = NULL,
        released_at = CURRENT_TIMESTAMP(3),
        release_reason = ?
      WHERE
        business_id = ?
        AND order_item_id = ?
        AND status = 'ACTIVE'
    `,
    [reason, businessId, orderItemId],
  );

  return result.affectedRows;
};

const releaseOrderReservations = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
  reason: string,
): Promise<number> => {
  const [result] = await connection.execute<ResultSetHeader>(
    `
      UPDATE inventory_reservations
      SET
        status = 'RELEASED',
        consumed_at = NULL,
        released_at = CURRENT_TIMESTAMP(3),
        release_reason = ?
      WHERE
        business_id = ?
        AND order_id = ?
        AND status = 'ACTIVE'
    `,
    [reason, businessId, orderId],
  );

  return result.affectedRows;
};

const consumeOrderItemReservations = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
  orderItemIds: readonly string[],
): Promise<number> => {
  if (orderItemIds.length === 0) {
    return 0;
  }

  const placeholders = orderItemIds.map(() => "?").join(", ");

  const [result] = await connection.execute<ResultSetHeader>(
    `
      UPDATE inventory_reservations
      SET
        status = 'CONSUMED',
        consumed_at = CURRENT_TIMESTAMP(3),
        released_at = NULL,
        release_reason = NULL
      WHERE
        business_id = ?
        AND order_id = ?
        AND order_item_id IN (${placeholders})
        AND status = 'ACTIVE'
    `,
    [businessId, orderId, ...orderItemIds],
  );

  return result.affectedRows;
};

const consumeOrderReservations = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
): Promise<InventoryReservation[]> => {
  const [activeRows] = await connection.execute<ReservationRow[]>(
    `
      ${reservationSelect}
      WHERE
        ir.business_id = ?
        AND ir.order_id = ?
        AND ir.status = 'ACTIVE'
      ORDER BY
        ir.inventory_item_id ASC,
        ir.id ASC
      FOR UPDATE
    `,
    [businessId, orderId],
  );

  if (activeRows.length === 0) {
    return [];
  }

  await connection.execute<ResultSetHeader>(
    `
      UPDATE inventory_reservations
      SET
        status = 'CONSUMED',
        consumed_at = CURRENT_TIMESTAMP(3),
        released_at = NULL,
        release_reason = NULL
      WHERE
        business_id = ?
        AND order_id = ?
        AND status = 'ACTIVE'
    `,
    [businessId, orderId],
  );

  const [consumedRows] = await connection.execute<ReservationRow[]>(
    `
      ${reservationSelect}
      WHERE
        ir.business_id = ?
        AND ir.order_id = ?
        AND ir.status = 'CONSUMED'
      ORDER BY
        ir.inventory_item_id ASC,
        ir.id ASC
    `,
    [businessId, orderId],
  );

  return consumedRows.map(mapReservationRow);
};

export {
  consumeOrderItemReservations,
  consumeOrderReservations,
  findActiveOrderReservations,
  findOrderItemReservations,
  releaseOrderItemReservations,
  releaseOrderReservations,
  reserveOrderItemInventory,
};
