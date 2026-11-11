import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { PaymentType } from "../../payment-methods/payment-method.types";
import type {
  CashSessionReconciliationData,
  PaymentMethodReconciliation,
} from "../cash-session-reconciliation.types";

interface MovementSummaryRow extends RowDataPacket {
  openingCashAmount: string;
  manualIncomeAmount: string;
  cashSaleAmount: string;
  withdrawalAmount: string;
  expenseAmount: string;
  cashRefundAmount: string;
  adjustmentInAmount: string;
  adjustmentOutAmount: string;
  movementNetAmount: string;
  calculatedExpectedCashAmount: string;
}

interface CommercialSummaryRow extends RowDataPacket {
  grossSaleCount: number | string;
  voidedSaleCount: number | string;
  refundCount: number | string;
  grossSaleAmount: string;
  voidedSaleAmount: string;
  refundedAmount: string;
  netCommercialAmount: string;
}

interface PaymentMethodSummaryRow extends RowDataPacket {
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  receivedAmount: string;
  voidedAmount: string;
  refundedAmount: string;
  netAmount: string;
}

const findCashSessionReconciliation = async (
  businessId: string,
  cashSessionId: string,
): Promise<CashSessionReconciliationData> => {
  const [movementResult, commercialResult, paymentMethodResult] =
    await Promise.all([
      databasePool.execute<MovementSummaryRow[]>(
        `
          SELECT
            CAST(cs.opening_cash_amount AS CHAR)
              AS openingCashAmount,

            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN cm.movement_type = 'MANUAL_INCOME'
                      THEN cm.amount
                    ELSE 0
                  END
                ),
                0
              )
              AS CHAR
            ) AS manualIncomeAmount,

            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN cm.movement_type = 'CASH_SALE'
                      THEN cm.amount
                    ELSE 0
                  END
                ),
                0
              )
              AS CHAR
            ) AS cashSaleAmount,

            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN cm.movement_type = 'WITHDRAWAL'
                      THEN cm.amount
                    ELSE 0
                  END
                ),
                0
              )
              AS CHAR
            ) AS withdrawalAmount,

            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN cm.movement_type = 'EXPENSE'
                      THEN cm.amount
                    ELSE 0
                  END
                ),
                0
              )
              AS CHAR
            ) AS expenseAmount,

            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN cm.movement_type = 'CASH_REFUND'
                      THEN cm.amount
                    ELSE 0
                  END
                ),
                0
              )
              AS CHAR
            ) AS cashRefundAmount,

            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN cm.movement_type = 'ADJUSTMENT_IN'
                      THEN cm.amount
                    ELSE 0
                  END
                ),
                0
              )
              AS CHAR
            ) AS adjustmentInAmount,

            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN cm.movement_type = 'ADJUSTMENT_OUT'
                      THEN cm.amount
                    ELSE 0
                  END
                ),
                0
              )
              AS CHAR
            ) AS adjustmentOutAmount,

            CAST(
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
            ) AS movementNetAmount,

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
            ) AS calculatedExpectedCashAmount
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
      ),

      databasePool.execute<CommercialSummaryRow[]>(
        `
          SELECT
            (
              SELECT COUNT(*)
              FROM sales AS s
              WHERE
                s.business_id = ?
                AND s.cash_session_id = ?
            ) AS grossSaleCount,

            (
              SELECT COUNT(DISTINCT svp.sale_id)
              FROM sale_void_payments AS svp
              WHERE
                svp.business_id = ?
                AND svp.cash_session_id = ?
            ) AS voidedSaleCount,

            (
              SELECT COUNT(*)
              FROM sale_refunds AS sr
              WHERE
                sr.business_id = ?
                AND sr.cash_session_id = ?
            ) AS refundCount,

            CAST(
              COALESCE(
                (
                  SELECT SUM(s.total)
                  FROM sales AS s
                  WHERE
                    s.business_id = ?
                    AND s.cash_session_id = ?
                ),
                0
              )
              AS CHAR
            ) AS grossSaleAmount,

            CAST(
              COALESCE(
                (
                  SELECT SUM(svp.amount)
                  FROM sale_void_payments AS svp
                  WHERE
                    svp.business_id = ?
                    AND svp.cash_session_id = ?
                ),
                0
              )
              AS CHAR
            ) AS voidedSaleAmount,

            CAST(
              COALESCE(
                (
                  SELECT SUM(sr.total_amount)
                  FROM sale_refunds AS sr
                  WHERE
                    sr.business_id = ?
                    AND sr.cash_session_id = ?
                ),
                0
              )
              AS CHAR
            ) AS refundedAmount,

            CAST(
              COALESCE(
                (
                  SELECT SUM(s.total)
                  FROM sales AS s
                  WHERE
                    s.business_id = ?
                    AND s.cash_session_id = ?
                ),
                0
              )
              -
              COALESCE(
                (
                  SELECT SUM(svp.amount)
                  FROM sale_void_payments AS svp
                  WHERE
                    svp.business_id = ?
                    AND svp.cash_session_id = ?
                ),
                0
              )
              -
              COALESCE(
                (
                  SELECT SUM(sr.total_amount)
                  FROM sale_refunds AS sr
                  WHERE
                    sr.business_id = ?
                    AND sr.cash_session_id = ?
                ),
                0
              )
              AS CHAR
            ) AS netCommercialAmount
        `,
        [
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
        ],
      ),

      databasePool.execute<PaymentMethodSummaryRow[]>(
        `
          SELECT
            events.paymentMethodCode,
            events.paymentMethodName,
            events.paymentType,

            CAST(SUM(events.receivedAmount) AS CHAR)
              AS receivedAmount,

            CAST(SUM(events.voidedAmount) AS CHAR)
              AS voidedAmount,

            CAST(SUM(events.refundedAmount) AS CHAR)
              AS refundedAmount,

            CAST(
              SUM(events.receivedAmount)
              - SUM(events.voidedAmount)
              - SUM(events.refundedAmount)
              AS CHAR
            ) AS netAmount
          FROM (
            SELECT
              sp.payment_method_code AS paymentMethodCode,
              sp.payment_method_name AS paymentMethodName,
              sp.payment_type AS paymentType,
              sp.amount AS receivedAmount,
              0.000000 AS voidedAmount,
              0.000000 AS refundedAmount
            FROM sale_payments AS sp
            INNER JOIN sales AS s
              ON s.business_id = sp.business_id
              AND s.id = sp.sale_id
            WHERE
              s.business_id = ?
              AND s.cash_session_id = ?

            UNION ALL

            SELECT
              svp.payment_method_code AS paymentMethodCode,
              svp.payment_method_name AS paymentMethodName,
              svp.payment_type AS paymentType,
              0.000000 AS receivedAmount,
              svp.amount AS voidedAmount,
              0.000000 AS refundedAmount
            FROM sale_void_payments AS svp
            WHERE
              svp.business_id = ?
              AND svp.cash_session_id = ?

            UNION ALL

            SELECT
              srp.payment_method_code AS paymentMethodCode,
              srp.payment_method_name AS paymentMethodName,
              srp.payment_type AS paymentType,
              0.000000 AS receivedAmount,
              0.000000 AS voidedAmount,
              srp.amount AS refundedAmount
            FROM sale_refund_payments AS srp
            INNER JOIN sale_refunds AS sr
              ON sr.business_id = srp.business_id
              AND sr.id = srp.refund_id
            WHERE
              sr.business_id = ?
              AND sr.cash_session_id = ?
          ) AS events
          GROUP BY
            events.paymentMethodCode,
            events.paymentMethodName,
            events.paymentType
          ORDER BY
            events.paymentMethodName ASC,
            events.paymentMethodCode ASC
        `,
        [
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
          businessId,
          cashSessionId,
        ],
      ),
    ]);

  const [movementRows] = movementResult;
  const [commercialRows] = commercialResult;
  const [paymentMethodRows] = paymentMethodResult;

  const movements = movementRows[0];
  const commercial = commercialRows[0];

  if (!movements || !commercial) {
    throw new Error("No fue posible calcular la conciliación del turno");
  }

  const paymentMethods: PaymentMethodReconciliation[] = paymentMethodRows.map(
    (row) => ({
      paymentMethodCode: row.paymentMethodCode,
      paymentMethodName: row.paymentMethodName,
      paymentType: row.paymentType,
      receivedAmount: row.receivedAmount,
      voidedAmount: row.voidedAmount,
      refundedAmount: row.refundedAmount,
      netAmount: row.netAmount,
    }),
  );

  return {
    movements: {
      openingCashAmount: movements.openingCashAmount,
      manualIncomeAmount: movements.manualIncomeAmount,
      cashSaleAmount: movements.cashSaleAmount,
      withdrawalAmount: movements.withdrawalAmount,
      expenseAmount: movements.expenseAmount,
      cashRefundAmount: movements.cashRefundAmount,
      adjustmentInAmount: movements.adjustmentInAmount,
      adjustmentOutAmount: movements.adjustmentOutAmount,
      movementNetAmount: movements.movementNetAmount,
      calculatedExpectedCashAmount: movements.calculatedExpectedCashAmount,
    },

    commercial: {
      grossSaleCount: Number(commercial.grossSaleCount),
      voidedSaleCount: Number(commercial.voidedSaleCount),
      refundCount: Number(commercial.refundCount),
      grossSaleAmount: commercial.grossSaleAmount,
      voidedSaleAmount: commercial.voidedSaleAmount,
      refundedAmount: commercial.refundedAmount,
      netCommercialAmount: commercial.netCommercialAmount,
    },

    paymentMethods,
  };
};

export { findCashSessionReconciliation };
