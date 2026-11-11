import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import { decimalToScaledBigInt } from "../../../shared/math/fixed-decimal";
import { reverseOrderItemInventory } from "../../orders/repositories/reverse-order-item-inventory.repository";
import type { SaleStatus } from "../sale.types";

interface SaleStateRow extends RowDataPacket {
  locationId: string;
  orderId: string;
  status: SaleStatus;
}

interface CashSessionStateRow extends RowDataPacket {
  locationId: string;
  status: "OPEN" | "CLOSED";
}

interface CashBalanceRow extends RowDataPacket {
  expectedCashAmount: string;
}

interface SaleItemStateRow extends RowDataPacket {
  orderItemId: string;
}

interface SalePaymentStateRow extends RowDataPacket {
  id: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: string;
  affectsCash: number;
  amount: string;
  reference: string | null;
}

type VoidSaleResult =
  | Readonly<{ kind: "VOIDED" }>
  | Readonly<{ kind: "SALE_NOT_FOUND" }>
  | Readonly<{
      kind: "SALE_NOT_VOIDABLE";
      status: SaleStatus;
    }>
  | Readonly<{ kind: "CASH_SESSION_NOT_FOUND" }>
  | Readonly<{ kind: "CASH_SESSION_NOT_OPEN" }>
  | Readonly<{ kind: "CASH_SESSION_LOCATION_MISMATCH" }>
  | Readonly<{
      kind: "INSUFFICIENT_CASH";
      expectedCashAmount: string;
      requiredCashAmount: string;
    }>;

const voidSaleRecord = async (
  businessId: string,
  membershipId: string,
  saleId: string,
  cashSessionId: string,
  reason: string,
): Promise<VoidSaleResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [saleRows] = await connection.execute<SaleStateRow[]>(
      `
        SELECT
          CAST(location_id AS CHAR) AS locationId,
          CAST(order_id AS CHAR) AS orderId,
          status
        FROM sales
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, saleId],
    );

    const sale = saleRows[0];

    if (!sale) {
      await connection.rollback();

      return {
        kind: "SALE_NOT_FOUND",
      };
    }

    if (sale.status !== "COMPLETED") {
      await connection.rollback();

      return {
        kind: "SALE_NOT_VOIDABLE",
        status: sale.status,
      };
    }

    const [sessionRows] = await connection.execute<CashSessionStateRow[]>(
      `
        SELECT
          CAST(cr.location_id AS CHAR) AS locationId,
          cs.status
        FROM cash_sessions AS cs
        INNER JOIN cash_registers AS cr
          ON cr.business_id = cs.business_id
          AND cr.id = cs.cash_register_id
        WHERE
          cs.business_id = ?
          AND cs.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, cashSessionId],
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

    if (cashSession.locationId !== sale.locationId) {
      await connection.rollback();

      return {
        kind: "CASH_SESSION_LOCATION_MISMATCH",
      };
    }

    const [paymentRows] = await connection.execute<SalePaymentStateRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          payment_method_code AS paymentMethodCode,
          payment_method_name AS paymentMethodName,
          payment_type AS paymentType,
          affects_cash AS affectsCash,
          CAST(amount AS CHAR) AS amount,
          reference
        FROM sale_payments
        WHERE
          business_id = ?
          AND sale_id = ?
        ORDER BY id ASC
        FOR UPDATE
      `,
      [businessId, saleId],
    );

    const cashRefundAmount = paymentRows
      .filter((payment) => Boolean(payment.affectsCash))
      .reduce(
        (total, payment) => total + decimalToScaledBigInt(payment.amount, 6),
        0n,
      );

    if (cashRefundAmount > 0n) {
      const [balanceRows] = await connection.execute<CashBalanceRow[]>(
        `
          SELECT
            CAST(
              cs.opening_cash_amount +
              COALESCE(
                SUM(
                  CASE
                    WHEN cm.movement_type IN (
                      'MANUAL_INCOME',
                      'CASH_SALE',
                      'ADJUSTMENT_IN'
                    )
                      THEN cm.amount

                    WHEN cm.movement_type IN (
                      'WITHDRAWAL',
                      'EXPENSE',
                      'CASH_REFUND',
                      'ADJUSTMENT_OUT'
                    )
                      THEN -cm.amount

                    ELSE 0
                  END
                ),
                0
              )
              AS CHAR
            ) AS expectedCashAmount
          FROM cash_sessions AS cs
          LEFT JOIN cash_movements AS cm
            ON cm.business_id = cs.business_id
            AND cm.cash_session_id = cs.id
          WHERE
            cs.business_id = ?
            AND cs.id = ?
          GROUP BY
            cs.id,
            cs.opening_cash_amount
        `,
        [businessId, cashSessionId],
      );

      const expectedCashAmount =
        balanceRows[0]?.expectedCashAmount ?? "0.000000";

      const availableCash = decimalToScaledBigInt(expectedCashAmount, 6);

      if (availableCash < cashRefundAmount) {
        await connection.rollback();

        return {
          kind: "INSUFFICIENT_CASH",
          expectedCashAmount,
          requiredCashAmount: paymentRows
            .filter((payment) => Boolean(payment.affectsCash))
            .reduce((total, payment) => total + Number(payment.amount), 0)
            .toFixed(2),
        };
      }
    }

    const [itemRows] = await connection.execute<SaleItemStateRow[]>(
      `
        SELECT
          CAST(order_item_id AS CHAR) AS orderItemId
        FROM sale_items
        WHERE
          business_id = ?
          AND sale_id = ?
        ORDER BY id ASC
        FOR UPDATE
      `,
      [businessId, saleId],
    );

    for (const item of itemRows) {
      await reverseOrderItemInventory(
        connection,
        businessId,
        membershipId,
        sale.orderId,
        item.orderItemId,
        `Anulación de la venta ${saleId}: ${reason}`,
      );
    }

    for (const payment of paymentRows) {
      const [voidPaymentResult] = await connection.execute<ResultSetHeader>(
        `
            INSERT INTO sale_void_payments (
              business_id,
              sale_id,
              cash_session_id,
              sale_payment_id,
              processed_by_membership_id,
              cash_movement_id,
              payment_method_code,
              payment_method_name,
              payment_type,
              affects_cash,
              amount,
              reference,
              reason
            )
            VALUES (
              ?, ?, ?, ?, ?, NULL,
              ?, ?, ?, ?, ?, ?, ?
            )
          `,
        [
          businessId,
          saleId,
          cashSessionId,
          payment.id,
          membershipId,
          payment.paymentMethodCode,
          payment.paymentMethodName,
          payment.paymentType,
          payment.affectsCash,
          payment.amount,
          payment.reference,
          reason,
        ],
      );

      if (!payment.affectsCash) {
        continue;
      }

      const voidPaymentId = voidPaymentResult.insertId.toString();

      const [cashMovementResult] = await connection.execute<ResultSetHeader>(
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
            VALUES (
              ?, ?, ?,
              'CASH_REFUND',
              ?,
              ?,
              ?,
              'REFUND_PAYMENT',
              ?
            )
          `,
        [
          businessId,
          cashSessionId,
          membershipId,
          payment.amount,
          `Anulación de la venta ${saleId}: ${reason}`,
          payment.reference,
          voidPaymentId,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE sale_void_payments
          SET cash_movement_id = ?
          WHERE
            business_id = ?
            AND id = ?
        `,
        [cashMovementResult.insertId.toString(), businessId, voidPaymentId],
      );
    }

    const [updateResult] = await connection.execute<ResultSetHeader>(
      `
        UPDATE sales
        SET
          status = 'VOIDED',
          voided_by_membership_id = ?,
          void_reason = ?,
          voided_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'COMPLETED'
      `,
      [membershipId, reason, businessId, saleId],
    );

    if (updateResult.affectedRows !== 1) {
      throw new Error("No fue posible marcar la venta como anulada");
    }

    await connection.commit();

    return {
      kind: "VOIDED",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { voidSaleRecord };
export type { VoidSaleResult };
