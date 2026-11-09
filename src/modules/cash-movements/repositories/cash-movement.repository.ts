import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CashMovement,
  CashMovementDirection,
  CashMovementType,
  CreateManualCashMovementData,
} from "../cash-movement.types";

type CashMovementRow = RowDataPacket & {
  id: string;
  businessId: string;
  cashSessionId: string;
  recordedByMembershipId: string;
  recordedByName: string;
  movementType: CashMovementType;
  amount: string;
  reason: string;
  reference: string | null;
  sourceType: string | null;
  sourceId: string | null;
  occurredAt: Date;
  createdAt: Date;
};

type CashSessionStateRow = RowDataPacket & {
  status: "OPEN" | "CLOSED";
};

type CreateCashMovementResult =
  | Readonly<{
      kind: "CREATED";
      cashMovement: CashMovement;
    }>
  | Readonly<{
      kind: "CASH_SESSION_NOT_FOUND";
    }>
  | Readonly<{
      kind: "CASH_SESSION_NOT_OPEN";
    }>;

const incomingMovementTypes = new Set<CashMovementType>([
  "MANUAL_INCOME",
  "CASH_SALE",
  "ADJUSTMENT_IN",
]);

const getMovementDirection = (
  movementType: CashMovementType,
): CashMovementDirection =>
  incomingMovementTypes.has(movementType) ? "IN" : "OUT";

const mapCashMovementRow = (row: CashMovementRow): CashMovement => ({
  id: row.id,
  businessId: row.businessId,
  cashSessionId: row.cashSessionId,
  recordedByMembershipId: row.recordedByMembershipId,
  recordedBy: {
    membershipId: row.recordedByMembershipId,
    fullName: row.recordedByName,
  },
  movementType: row.movementType,
  direction: getMovementDirection(row.movementType),
  amount: row.amount,
  reason: row.reason,
  reference: row.reference,
  sourceType: row.sourceType,
  sourceId: row.sourceId,
  occurredAt: row.occurredAt,
  createdAt: row.createdAt,
});

const cashMovementSelect = `
  SELECT
    CAST(cm.id AS CHAR) AS id,
    CAST(cm.business_id AS CHAR) AS businessId,
    CAST(cm.cash_session_id AS CHAR) AS cashSessionId,
    CAST(cm.recorded_by_membership_id AS CHAR)
      AS recordedByMembershipId,
    recorded_user.full_name AS recordedByName,
    cm.movement_type AS movementType,
    CAST(cm.amount AS CHAR) AS amount,
    cm.reason,
    cm.reference,
    cm.source_type AS sourceType,
    CAST(cm.source_id AS CHAR) AS sourceId,
    cm.occurred_at AS occurredAt,
    cm.created_at AS createdAt
  FROM cash_movements AS cm
  INNER JOIN business_memberships AS recorded_membership
    ON recorded_membership.business_id = cm.business_id
    AND recorded_membership.id = cm.recorded_by_membership_id
  INNER JOIN users AS recorded_user
    ON recorded_user.id = recorded_membership.user_id
`;

const findCashMovementById = async (
  businessId: string,
  cashMovementId: string,
): Promise<CashMovement | null> => {
  const [rows] = await databasePool.execute<CashMovementRow[]>(
    `
      ${cashMovementSelect}
      WHERE
        cm.business_id = ?
        AND cm.id = ?
      LIMIT 1
    `,
    [businessId, cashMovementId],
  );

  return rows[0] ? mapCashMovementRow(rows[0]) : null;
};

const findCashMovementsBySessionId = async (
  businessId: string,
  cashSessionId: string,
): Promise<CashMovement[]> => {
  const [rows] = await databasePool.execute<CashMovementRow[]>(
    `
      ${cashMovementSelect}
      WHERE
        cm.business_id = ?
        AND cm.cash_session_id = ?
      ORDER BY
        cm.occurred_at ASC,
        cm.id ASC
    `,
    [businessId, cashSessionId],
  );

  return rows.map(mapCashMovementRow);
};

const insertManualCashMovement = async (
  businessId: string,
  data: CreateManualCashMovementData,
): Promise<CreateCashMovementResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [cashSessionRows] = await connection.execute<CashSessionStateRow[]>(
      `
          SELECT status
          FROM cash_sessions
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, data.cashSessionId],
    );

    const cashSession = cashSessionRows[0];

    if (!cashSession) {
      await connection.rollback();

      return {
        kind: "CASH_SESSION_NOT_FOUND",
      };
    }

    if (cashSession.status !== "OPEN") {
      await connection.rollback();

      return {
        kind: "CASH_SESSION_NOT_OPEN",
      };
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO cash_movements (
          business_id,
          cash_session_id,
          recorded_by_membership_id,
          movement_type,
          amount,
          reason,
          reference,
          source_type,
          source_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      `,
      [
        businessId,
        data.cashSessionId,
        data.recordedByMembershipId,
        data.movementType,
        data.amount,
        data.reason,
        data.reference,
      ],
    );

    const [movementRows] = await connection.execute<CashMovementRow[]>(
      `
        ${cashMovementSelect}
        WHERE
          cm.business_id = ?
          AND cm.id = ?
        LIMIT 1
      `,
      [businessId, result.insertId.toString()],
    );

    const movementRow = movementRows[0];

    if (!movementRow) {
      throw new Error("No fue posible recuperar el movimiento creado");
    }

    await connection.commit();

    return {
      kind: "CREATED",
      cashMovement: mapCashMovementRow(movementRow),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  findCashMovementById,
  findCashMovementsBySessionId,
  insertManualCashMovement,
};

export type { CreateCashMovementResult };
