import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { CloseCashSessionData } from "../cash-session.types";

interface CashSessionStateRow extends RowDataPacket {
  status: "OPEN" | "CLOSED";
  openingCashAmount: string;
}

interface CashMovementBalanceRow extends RowDataPacket {
  movementNetAmount: string;
}

type CloseCashSessionResult =
  | Readonly<{
      kind: "CLOSED";
      expectedCashAmount: string;
      countedCashAmount: string;
      differenceAmount: string;
    }>
  | Readonly<{
      kind: "CASH_SESSION_NOT_FOUND";
    }>
  | Readonly<{
      kind: "CASH_SESSION_NOT_OPEN";
    }>
  | Readonly<{
      kind: "NEGATIVE_EXPECTED_CASH";
      expectedCashAmount: string;
    }>;

const parseMoneyToCents = (value: string): bigint => {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (!match) {
    throw new Error(`El valor monetario no es válido: ${value}`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2] ?? "0";
  const fraction = (match[3] ?? "").padEnd(2, "0");

  return sign * (BigInt(whole) * 100n + BigInt(fraction || "0"));
};

const formatCents = (value: bigint): string => {
  const isNegative = value < 0n;
  const absolute = isNegative ? -value : value;

  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");

  return `${isNegative ? "-" : ""}${whole.toString()}.${fraction}`;
};

const closeCashSession = async (
  businessId: string,
  data: CloseCashSessionData,
): Promise<CloseCashSessionResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    /*
     * Este bloqueo también serializa ventas y movimientos manuales,
     * porque esas operaciones bloquean la misma sesión antes de registrar
     * movimientos de efectivo.
     */
    const [sessionRows] = await connection.execute<CashSessionStateRow[]>(
      `
        SELECT
          status,
          CAST(opening_cash_amount AS CHAR) AS openingCashAmount
        FROM cash_sessions
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, data.cashSessionId],
    );

    const cashSession = sessionRows[0];

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

    const [movementRows] = await connection.execute<CashMovementBalanceRow[]>(
      `
          SELECT
            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN movement_type IN (
                      'MANUAL_INCOME',
                      'CASH_SALE',
                      'ADJUSTMENT_IN'
                    )
                      THEN amount

                    WHEN movement_type IN (
                      'WITHDRAWAL',
                      'EXPENSE',
                      'CASH_REFUND',
                      'ADJUSTMENT_OUT'
                    )
                      THEN -amount

                    ELSE 0
                  END
                ),
                0.00
              )
              AS CHAR
            ) AS movementNetAmount
          FROM cash_movements
          WHERE
            business_id = ?
            AND cash_session_id = ?
        `,
      [businessId, data.cashSessionId],
    );

    const movementNetAmount = movementRows[0]?.movementNetAmount ?? "0.00";

    const expectedCashInCents =
      parseMoneyToCents(cashSession.openingCashAmount) +
      parseMoneyToCents(movementNetAmount);

    if (expectedCashInCents < 0n) {
      await connection.rollback();

      return {
        kind: "NEGATIVE_EXPECTED_CASH",
        expectedCashAmount: formatCents(expectedCashInCents),
      };
    }

    const countedCashInCents = parseMoneyToCents(data.countedCashAmount);

    const differenceInCents = countedCashInCents - expectedCashInCents;

    const expectedCashAmount = formatCents(expectedCashInCents);
    const countedCashAmount = formatCents(countedCashInCents);
    const differenceAmount = formatCents(differenceInCents);

    const [updateResult] = await connection.execute<ResultSetHeader>(
      `
        UPDATE cash_sessions
        SET
          closed_by_membership_id = ?,
          status = 'CLOSED',
          expected_cash_amount = ?,
          counted_cash_amount = ?,
          difference_amount = ?,
          closing_notes = ?,
          closed_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'OPEN'
      `,
      [
        data.closedByMembershipId,
        expectedCashAmount,
        countedCashAmount,
        differenceAmount,
        data.closingNotes,
        businessId,
        data.cashSessionId,
      ],
    );

    if (updateResult.affectedRows !== 1) {
      throw new Error("No fue posible cerrar el turno de caja");
    }

    await connection.commit();

    return {
      kind: "CLOSED",
      expectedCashAmount,
      countedCashAmount,
      differenceAmount,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { closeCashSession };
export type { CloseCashSessionResult };
