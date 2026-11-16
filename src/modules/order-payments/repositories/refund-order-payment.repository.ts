import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderPaymentStatus, OrderStatus } from "../../orders/order.types";
import type { PaymentType } from "../../payment-methods/payment-method.types";
import {
  centsToMoney,
  databaseMoneyToExactCents,
} from "../../sales/sale-refund-calculation";
import type {
  RefundedOrderPayment,
  RefundOrderPaymentData,
} from "../order-payment.types";

interface OrderStateRow extends RowDataPacket {
  locationId: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
}

interface PaymentBatchRow extends RowDataPacket {
  id: string;
  status: "VERIFIED" | "CONSUMED" | "REFUNDED" | "VOIDED";
  paidTotal: string;
}

interface PaymentRow extends RowDataPacket {
  id: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  requiresReference: number;
  affectsCash: number;
  amount: string;
}

interface CashSessionRow extends RowDataPacket {
  locationId: string;
  status: "OPEN" | "CLOSED";
}

interface CashBalanceRow extends RowDataPacket {
  expectedCashAmount: string;
}

type RefundOrderPaymentResult =
  | Readonly<{
      kind: "REFUNDED";
      refund: RefundedOrderPayment;
    }>
  | Readonly<{ kind: "ORDER_NOT_FOUND" }>
  | Readonly<{
      kind: "ORDER_NOT_REFUNDABLE";
      orderStatus: OrderStatus;
      paymentStatus: OrderPaymentStatus;
    }>
  | Readonly<{ kind: "PAYMENT_BATCH_NOT_FOUND" }>
  | Readonly<{ kind: "PAYMENT_SET_MISMATCH" }>
  | Readonly<{
      kind: "PAYMENT_REFERENCE_REQUIRED";
      paymentMethodName: string;
    }>
  | Readonly<{ kind: "CASH_SESSION_REQUIRED" }>
  | Readonly<{ kind: "CASH_SESSION_NOT_FOUND" }>
  | Readonly<{ kind: "CASH_SESSION_NOT_OPEN" }>
  | Readonly<{ kind: "CASH_SESSION_LOCATION_MISMATCH" }>
  | Readonly<{
      kind: "INSUFFICIENT_CASH";
      expectedCashAmount: string;
      requiredCashAmount: string;
    }>;

const refundOrderPayment = async (
  businessId: string,
  orderId: string,
  data: RefundOrderPaymentData,
): Promise<RefundOrderPaymentResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<OrderStateRow[]>(
      `
        SELECT
          CAST(location_id AS CHAR) AS locationId,
          status,
          payment_status AS paymentStatus
        FROM orders
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    const order = orderRows[0];

    if (!order) {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_FOUND",
      };
    }

    if (
      (order.status !== "OPEN" && order.status !== "CONFIRMED") ||
      order.paymentStatus !== "VERIFIED"
    ) {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_REFUNDABLE",
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      };
    }

    const [batchRows] = await connection.execute<PaymentBatchRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          status,
          CAST(paid_total AS CHAR) AS paidTotal
        FROM order_payment_batches
        WHERE
          business_id = ?
          AND order_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    const paymentBatch = batchRows[0];

    if (paymentBatch?.status !== "VERIFIED") {
      await connection.rollback();

      return {
        kind: "PAYMENT_BATCH_NOT_FOUND",
      };
    }

    const [paymentRows] = await connection.execute<PaymentRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          payment_method_code AS paymentMethodCode,
          payment_method_name AS paymentMethodName,
          payment_type AS paymentType,
          requires_reference AS requiresReference,
          affects_cash AS affectsCash,
          CAST(amount AS CHAR) AS amount
        FROM order_payments
        WHERE
          business_id = ?
          AND payment_batch_id = ?
        ORDER BY id ASC
        FOR UPDATE
      `,
      [businessId, paymentBatch.id],
    );

    if (paymentRows.length !== data.payments.length) {
      await connection.rollback();

      return {
        kind: "PAYMENT_SET_MISMATCH",
      };
    }

    const requestedPaymentsById = new Map(
      data.payments.map((payment) => [payment.orderPaymentId, payment]),
    );

    for (const payment of paymentRows) {
      const requestedPayment = requestedPaymentsById.get(payment.id);

      if (!requestedPayment) {
        await connection.rollback();

        return {
          kind: "PAYMENT_SET_MISMATCH",
        };
      }

      if (payment.requiresReference && !requestedPayment.reference) {
        await connection.rollback();

        return {
          kind: "PAYMENT_REFERENCE_REQUIRED",
          paymentMethodName: payment.paymentMethodName,
        };
      }
    }

    const paidTotalCents = databaseMoneyToExactCents(paymentBatch.paidTotal);

    if (paidTotalCents === null) {
      throw new Error(
        `El pago anticipado contiene un total subcentavo: ${paymentBatch.paidTotal}`,
      );
    }

    let refundTotalCents = 0n;
    let cashRefundCents = 0n;

    for (const payment of paymentRows) {
      const amountCents = databaseMoneyToExactCents(payment.amount);

      if (amountCents === null) {
        throw new Error(
          `El pago anticipado ${payment.id} contiene un importe subcentavo`,
        );
      }

      refundTotalCents += amountCents;

      if (payment.affectsCash) {
        cashRefundCents += amountCents;
      }
    }

    if (refundTotalCents !== paidTotalCents) {
      throw new Error(
        "Los pagos anticipados no coinciden con el total del lote",
      );
    }

    let refundCashSessionId: string | null = null;

    if (cashRefundCents > 0n) {
      if (!data.cashSessionId) {
        await connection.rollback();

        return {
          kind: "CASH_SESSION_REQUIRED",
        };
      }

      const [cashSessionRows] = await connection.execute<CashSessionRow[]>(
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

      if (cashSession.locationId !== order.locationId) {
        await connection.rollback();

        return {
          kind: "CASH_SESSION_LOCATION_MISMATCH",
        };
      }

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
        [businessId, data.cashSessionId],
      );

      const expectedCashAmount = balanceRows[0]?.expectedCashAmount ?? "0.00";

      const expectedCashCents = databaseMoneyToExactCents(expectedCashAmount);

      if (expectedCashCents === null) {
        throw new Error(
          `La caja contiene un saldo subcentavo incompatible: ${expectedCashAmount}`,
        );
      }

      if (expectedCashCents < cashRefundCents) {
        await connection.rollback();

        return {
          kind: "INSUFFICIENT_CASH",
          expectedCashAmount: centsToMoney(expectedCashCents),
          requiredCashAmount: centsToMoney(cashRefundCents),
        };
      }

      refundCashSessionId = data.cashSessionId;
    }

    const [refundResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO order_payment_refunds (
          business_id,
          payment_batch_id,
          cash_session_id,
          processed_by_membership_id,
          total_amount,
          reason
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        businessId,
        paymentBatch.id,
        refundCashSessionId,
        data.processedByMembershipId,
        centsToMoney(refundTotalCents),
        data.reason,
      ],
    );

    const refundId = refundResult.insertId.toString();

    for (const payment of paymentRows) {
      const requestedPayment = requestedPaymentsById.get(payment.id);

      if (!requestedPayment) {
        throw new Error(
          "No fue posible recuperar un pago previamente validado",
        );
      }

      const [lineResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO order_payment_refund_lines (
            business_id,
            refund_id,
            order_payment_id,
            cash_movement_id,
            payment_method_code,
            payment_method_name,
            payment_type,
            requires_reference,
            affects_cash,
            amount,
            reference,
            notes
          )
          VALUES (
            ?, ?, ?, NULL,
            ?, ?, ?, ?, ?,
            ?, ?, ?
          )
        `,
        [
          businessId,
          refundId,
          payment.id,
          payment.paymentMethodCode,
          payment.paymentMethodName,
          payment.paymentType,
          payment.requiresReference,
          payment.affectsCash,
          payment.amount,
          requestedPayment.reference,
          requestedPayment.notes,
        ],
      );

      if (!payment.affectsCash) {
        continue;
      }

      if (!refundCashSessionId) {
        throw new Error(
          "No fue posible resolver el turno para devolver el efectivo",
        );
      }

      const refundLineId = lineResult.insertId.toString();

      const [movementResult] = await connection.execute<ResultSetHeader>(
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
              ?,
              ?,
              ?,
              'CASH_REFUND',
              ?,
              ?,
              ?,
              'ORDER_PAYMENT_REFUND',
              ?
            )
          `,
        [
          businessId,
          refundCashSessionId,
          data.processedByMembershipId,
          payment.amount,
          `Devolución de pago anticipado ${refundId}: ${data.reason}`,
          requestedPayment.reference,
          refundLineId,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE order_payment_refund_lines
          SET cash_movement_id = ?
          WHERE
            business_id = ?
            AND id = ?
        `,
        [movementResult.insertId.toString(), businessId, refundLineId],
      );
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE order_payment_batches
        SET
          status = 'REFUNDED',
          refunded_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'VERIFIED'
      `,
      [businessId, paymentBatch.id],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET payment_status = 'REFUNDED'
        WHERE
          business_id = ?
          AND id = ?
          AND payment_status = 'VERIFIED'
      `,
      [businessId, orderId],
    );

    await connection.commit();

    return {
      kind: "REFUNDED",
      refund: {
        refundId,
        totalAmount: centsToMoney(refundTotalCents),
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { refundOrderPayment };

export type { RefundOrderPaymentResult };
