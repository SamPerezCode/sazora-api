import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreateInventoryMovementData,
  InventoryMovement,
  InventoryMovementDirection,
  InventoryMovementLine,
  InventoryMovementSummary,
  InventoryMovementType,
} from "../inventory-movement.types";

type MovementRow = RowDataPacket & {
  id: string;
  businessId: string;
  movementType: InventoryMovementType;
  sourceType: string | null;
  sourceId: string | null;
  notes: string | null;
  createdByMembershipId: string;
  createdByName: string;
  createdAt: Date;
};

type MovementSummaryRow = MovementRow & {
  lineCount: string;
};

type MovementLineRow = RowDataPacket & {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: string;
  direction: InventoryMovementDirection;
  quantity: string;
  balanceBefore: string;
  balanceAfter: string;
  notes: string | null;
  createdAt: Date;
};

type LockedInventoryItemRow = RowDataPacket & {
  id: string;
  currentStock: string;
};

type CreateMovementResult =
  | Readonly<{
      kind: "CREATED";
      movement: InventoryMovement;
    }>
  | Readonly<{
      kind: "ITEMS_NOT_AVAILABLE";
      inventoryItemIds: readonly string[];
    }>
  | Readonly<{
      kind: "INSUFFICIENT_STOCK";
      inventoryItemId: string;
      availableQuantity: string;
      requestedQuantity: string;
    }>;

const decimalToThousandths = (value: string): bigint => {
  const normalizedValue = value.trim();
  const isNegative = normalizedValue.startsWith("-");
  const unsignedValue = isNegative ? normalizedValue.slice(1) : normalizedValue;

  const [whole = "0", fraction = ""] = unsignedValue.split(".");

  const quantity =
    BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0").slice(0, 3));

  return isNegative ? -quantity : quantity;
};

const thousandthsToDecimal = (value: bigint): string => {
  const isNegative = value < 0n;
  const absoluteValue = isNegative ? -value : value;

  const whole = absoluteValue / 1000n;
  const fraction = (absoluteValue % 1000n).toString().padStart(3, "0");

  const sign = isNegative ? "-" : "";

  return `${sign}${whole.toString()}.${fraction}`;
};
const movementSelect = `
  SELECT
    CAST(im.id AS CHAR) AS id,
    CAST(im.business_id AS CHAR) AS businessId,
    im.movement_type AS movementType,
    im.source_type AS sourceType,
    im.source_id AS sourceId,
    im.notes,
    CAST(im.created_by_membership_id AS CHAR)
      AS createdByMembershipId,
    u.full_name AS createdByName,
    im.created_at AS createdAt
  FROM inventory_movements AS im
  INNER JOIN business_memberships AS bm
    ON bm.business_id = im.business_id
    AND bm.id = im.created_by_membership_id
  INNER JOIN users AS u
    ON u.id = bm.user_id
`;

const mapMovementRow = (
  row: MovementRow,
  lines: readonly InventoryMovementLine[],
): InventoryMovement => ({
  id: row.id,
  businessId: row.businessId,
  movementType: row.movementType,
  sourceType: row.sourceType,
  sourceId: row.sourceId,
  notes: row.notes,
  createdByMembershipId: row.createdByMembershipId,
  createdByName: row.createdByName,
  createdAt: row.createdAt,
  lines,
});

const findInventoryMovementById = async (
  businessId: string,
  inventoryMovementId: string,
): Promise<InventoryMovement | null> => {
  const [movementRows] = await databasePool.execute<MovementRow[]>(
    `
        ${movementSelect}
        WHERE
          im.business_id = ?
          AND im.id = ?
        LIMIT 1
      `,
    [businessId, inventoryMovementId],
  );

  const movement = movementRows[0];

  if (!movement) {
    return null;
  }

  const [lineRows] = await databasePool.execute<MovementLineRow[]>(
    `
        SELECT
          CAST(iml.id AS CHAR) AS id,
          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,
          ii.name AS inventoryItemName,
          ii.base_unit AS baseUnit,
          iml.direction,
          CAST(iml.quantity AS CHAR) AS quantity,
          CAST(iml.balance_before AS CHAR)
            AS balanceBefore,
          CAST(iml.balance_after AS CHAR)
            AS balanceAfter,
          iml.notes,
          iml.created_at AS createdAt
        FROM inventory_movement_lines AS iml
        INNER JOIN inventory_items AS ii
          ON ii.business_id = iml.business_id
          AND ii.id = iml.inventory_item_id
        WHERE
          iml.business_id = ?
          AND iml.movement_id = ?
        ORDER BY iml.id ASC
      `,
    [businessId, inventoryMovementId],
  );

  return mapMovementRow(movement, lineRows);
};

const findInventoryMovements = async (
  businessId: string,
  movementType?: InventoryMovementType,
): Promise<InventoryMovementSummary[]> => {
  const typeCondition =
    movementType !== undefined ? "AND im.movement_type = ?" : "";

  const queryValues =
    movementType !== undefined ? [businessId, movementType] : [businessId];

  const [rows] = await databasePool.execute<MovementSummaryRow[]>(
    `
        SELECT
          movement_data.*,
          (
            SELECT COUNT(*)
            FROM inventory_movement_lines AS iml
            WHERE
              iml.business_id =
                movement_data.businessId
              AND iml.movement_id =
                movement_data.id
          ) AS lineCount
        FROM (
          ${movementSelect}
          WHERE
            im.business_id = ?
            ${typeCondition}
        ) AS movement_data
        ORDER BY
          movement_data.createdAt DESC,
          movement_data.id DESC
      `,
    queryValues,
  );

  return rows.map((row) => ({
    id: row.id,
    businessId: row.businessId,
    movementType: row.movementType,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    notes: row.notes,
    createdByMembershipId: row.createdByMembershipId,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    lineCount: Number(row.lineCount),
  }));
};

const createInventoryMovementRecord = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryMovementData,
): Promise<CreateMovementResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const itemIds = [...data.lines]
      .map((line) => line.inventoryItemId)
      .sort((first, second) => (BigInt(first) < BigInt(second) ? -1 : 1));

    const placeholders = itemIds.map(() => "?").join(", ");

    const [itemRows] = await connection.execute<LockedInventoryItemRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            CAST(current_stock AS CHAR)
              AS currentStock
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

    const itemById = new Map(itemRows.map((item) => [item.id, item]));

    const unavailableIds = itemIds.filter((itemId) => !itemById.has(itemId));

    if (unavailableIds.length > 0) {
      await connection.rollback();

      return {
        kind: "ITEMS_NOT_AVAILABLE",
        inventoryItemIds: unavailableIds,
      };
    }

    for (const line of data.lines) {
      const item = itemById.get(line.inventoryItemId);

      if (!item) {
        throw new Error("No fue posible recuperar un artículo bloqueado");
      }

      const currentStock = decimalToThousandths(item.currentStock);

      const quantity = decimalToThousandths(line.quantity);

      if (line.direction === "OUT" && currentStock < quantity) {
        await connection.rollback();

        return {
          kind: "INSUFFICIENT_STOCK",
          inventoryItemId: line.inventoryItemId,
          availableQuantity: thousandthsToDecimal(currentStock),
          requestedQuantity: thousandthsToDecimal(quantity),
        };
      }
    }

    const [movementResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO inventory_movements (
            business_id,
            movement_type,
            source_type,
            source_id,
            notes,
            created_by_membership_id
          )
          VALUES (?, ?, NULL, NULL, ?, ?)
        `,
      [businessId, data.movementType, data.notes, membershipId],
    );

    const movementId = movementResult.insertId.toString();

    for (const line of data.lines) {
      const item = itemById.get(line.inventoryItemId);

      if (!item) {
        throw new Error("No fue posible recuperar un artículo validado");
      }

      const balanceBefore = decimalToThousandths(item.currentStock);

      const quantity = decimalToThousandths(line.quantity);

      const balanceAfter =
        line.direction === "IN"
          ? balanceBefore + quantity
          : balanceBefore - quantity;

      const balanceBeforeText = thousandthsToDecimal(balanceBefore);

      const balanceAfterText = thousandthsToDecimal(balanceAfter);

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO inventory_movement_lines (
            business_id,
            movement_id,
            inventory_item_id,
            direction,
            quantity,
            balance_before,
            balance_after,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          businessId,
          movementId,
          line.inventoryItemId,
          line.direction,
          line.quantity,
          balanceBeforeText,
          balanceAfterText,
          line.notes,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE inventory_items
          SET current_stock = ?
          WHERE
            business_id = ?
            AND id = ?
        `,
        [balanceAfterText, businessId, line.inventoryItemId],
      );

      item.currentStock = balanceAfterText;
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

export {
  createInventoryMovementRecord,
  findInventoryMovementById,
  findInventoryMovements,
};

export type { CreateMovementResult };
