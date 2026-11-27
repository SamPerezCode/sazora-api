import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { PaymentType } from "../../payment-methods/payment-method.types";
import { calculateSaleSettlement } from "../../sales/sale-settlement-calculation";
import type {
  OrderPayment,
  OrderPaymentBatch,
  RecordOrderPaymentData,
} from "../order-payment.types";

interface OrderStateRow extends RowDataPacket {
  id: string;
  locationId: string;
  serviceType: "TABLE" | "TAKEAWAY" | "DELIVERY";
  status: "OPEN" | "CONFIRMED" | "DELIVERED" | "CLOSED" | "CANCELLED";
  paymentStatus: "PENDING" | "VERIFIED" | "CONSUMED" | "REFUNDED" | "VOIDED";
  total: string;
}

interface CashSessionStateRow extends RowDataPacket {
  id: string;
  locationId: string;
  status: "OPEN" | "CLOSED";
}

interface PaymentMethodStateRow extends RowDataPacket {
  id: string;
  code: string;
  name: string;
  paymentType: PaymentType;
  requiresReference: number;
  affectsCash: number;
  allowsChange: number;
  isActive: number;
}

interface OrderPaymentBatchRow extends RowDataPacket {
  id: string;
  businessId: string;
  orderId: string;
  cashSessionId: string;
  verifiedByMembershipId: string;
  saleId: string | null;
  status: "VERIFIED" | "CONSUMED" | "REFUNDED" | "VOIDED";
  idempotencyKey: string;
  paidTotal: string;
  changeTotal: string;
  verifiedAt: Date;
  consumedAt: Date | null;
  refundedAt: Date | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderPaymentRow extends RowDataPacket {
  id: string;
  businessId: string;
  paymentBatchId: string;
  paymentMethodId: string;
  processedByMembershipId: string;
  cashMovementId: string | null;
  salePaymentId: string | null;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  requiresReference: number;
  affectsCash: number;
  allowsChange: number;
  amount: string;
  tenderedAmount: string;
  changeAmount: string;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
}

type RecordOrderPaymentResult =
  | {
      kind: "RECORDED";
      created: boolean;
      paymentBatch: OrderPaymentBatch;
    }
  | { kind: "ORDER_NOT_FOUND" }
  | { kind: "TABLE_ORDER_NOT_PREPAID" }
  | { kind: "ORDER_NOT_OPEN" }
  | { kind: "ORDER_ALREADY_PAID" }
  | { kind: "IDEMPOTENCY_KEY_CONFLICT" }
  | { kind: "CASH_SESSION_NOT_FOUND" }
  | { kind: "CASH_SESSION_NOT_OPEN" }
  | { kind: "CASH_SESSION_LOCATION_MISMATCH" }
  | {
      kind: "PAYMENT_METHOD_NOT_AVAILABLE";
      paymentMethodId: string;
    }
  | {
      kind: "PAYMENT_REFERENCE_REQUIRED";
      paymentMethodName: string;
    };

const mapPaymentRow = (row: OrderPaymentRow): OrderPayment => ({
  id: row.id,
  businessId: row.businessId,
  paymentBatchId: row.paymentBatchId,
  paymentMethodId: row.paymentMethodId,
  processedByMembershipId: row.processedByMembershipId,
  cashMovementId: row.cashMovementId,
  salePaymentId: row.salePaymentId,
  paymentMethodCode: row.paymentMethodCode,
  paymentMethodName: row.paymentMethodName,
  paymentType: row.paymentType,
  requiresReference: Boolean(row.requiresReference),
  affectsCash: Boolean(row.affectsCash),
  allowsChange: Boolean(row.allowsChange),
  amount: row.amount,
  tenderedAmount: row.tenderedAmount,
  changeAmount: row.changeAmount,
  reference: row.reference,
  notes: row.notes,
  createdAt: row.createdAt,
});

const findOrderPaymentBatchWithConnection = async (
  connection: PoolConnection,
  businessId: string,
  orderId: string,
): Promise<OrderPaymentBatch | null> => {
  const [batchRows] = await connection.execute<OrderPaymentBatchRow[]>(
    `
      SELECT
        CAST(opb.id AS CHAR) AS id,
        CAST(opb.business_id AS CHAR) AS businessId,
        CAST(opb.order_id AS CHAR) AS orderId,
        CAST(opb.cash_session_id AS CHAR) AS cashSessionId,
        CAST(opb.verified_by_membership_id AS CHAR)
          AS verifiedByMembershipId,
        CAST(opb.sale_id AS CHAR) AS saleId,
        opb.status,
        opb.idempotency_key AS idempotencyKey,
        CAST(opb.paid_total AS CHAR) AS paidTotal,
        CAST(opb.change_total AS CHAR) AS changeTotal,
        opb.verified_at AS verifiedAt,
        opb.consumed_at AS consumedAt,
        opb.refunded_at AS refundedAt,
        opb.voided_at AS voidedAt,
        opb.created_at AS createdAt,
        opb.updated_at AS updatedAt
      FROM order_payment_batches AS opb
      WHERE
        opb.business_id = ?
        AND opb.order_id = ?
      LIMIT 1
    `,
    [businessId, orderId],
  );

  const batch = batchRows[0];

  if (!batch) {
    return null;
  }

  const [paymentRows] = await connection.execute<OrderPaymentRow[]>(
    `
      SELECT
        CAST(op.id AS CHAR) AS id,
        CAST(op.business_id AS CHAR) AS businessId,
        CAST(op.payment_batch_id AS CHAR) AS paymentBatchId,
        CAST(op.payment_method_id AS CHAR) AS paymentMethodId,
        CAST(op.processed_by_membership_id AS CHAR)
          AS processedByMembershipId,
        CAST(op.cash_movement_id AS CHAR) AS cashMovementId,
        CAST(op.sale_payment_id AS CHAR) AS salePaymentId,
        op.payment_method_code AS paymentMethodCode,
        op.payment_method_name AS paymentMethodName,
        op.payment_type AS paymentType,
        op.requires_reference AS requiresReference,
        op.affects_cash AS affectsCash,
        op.allows_change AS allowsChange,
        CAST(op.amount AS CHAR) AS amount,
        CAST(op.tendered_amount AS CHAR) AS tenderedAmount,
        CAST(op.change_amount AS CHAR) AS changeAmount,
        op.reference,
        op.notes,
        op.created_at AS createdAt
      FROM order_payments AS op
      WHERE
        op.business_id = ?
        AND op.payment_batch_id = ?
      ORDER BY op.id ASC
    `,
    [businessId, batch.id],
  );

  return {
    id: batch.id,
    businessId: batch.businessId,
    orderId: batch.orderId,
    cashSessionId: batch.cashSessionId,
    verifiedByMembershipId: batch.verifiedByMembershipId,
    saleId: batch.saleId,
    status: batch.status,
    idempotencyKey: batch.idempotencyKey,
    paidTotal: batch.paidTotal,
    changeTotal: batch.changeTotal,
    verifiedAt: batch.verifiedAt,
    consumedAt: batch.consumedAt,
    refundedAt: batch.refundedAt,
    voidedAt: batch.voidedAt,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    payments: paymentRows.map(mapPaymentRow),
  };
};

const findOrderPaymentBatch = async (
  businessId: string,
  orderId: string,
): Promise<OrderPaymentBatch | null> => {
  const connection = await databasePool.getConnection();

  try {
    return await findOrderPaymentBatchWithConnection(
      connection,
      businessId,
      orderId,
    );
  } finally {
    connection.release();
  }
};

const recordOrderPayment = async (
  businessId: string,
  orderId: string,
  data: RecordOrderPaymentData,
): Promise<RecordOrderPaymentResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<OrderStateRow[]>(
      `
        SELECT
          CAST(o.id AS CHAR) AS id,
          CAST(o.location_id AS CHAR) AS locationId,
          o.service_type AS serviceType,
          o.status,
          o.payment_status AS paymentStatus,
          CAST(
            ROUND(
              COALESCE(
                SUM(
                  CASE
                    WHEN oi.status = 'ACTIVE'
                      THEN oi.quantity * oi.unit_price
                    ELSE 0
                  END
                ),
                0
              ),
              2
            )
            AS CHAR
          ) AS total
        FROM orders AS o
        LEFT JOIN order_items AS oi
          ON oi.business_id = o.business_id
          AND oi.order_id = o.id
        WHERE
          o.business_id = ?
          AND o.id = ?
        GROUP BY
          o.id,
          o.location_id,
          o.service_type,
          o.status,
          o.payment_status
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, orderId],
    );

    const order = orderRows[0];

    if (!order) {
      await connection.rollback();
      return { kind: "ORDER_NOT_FOUND" };
    }

    if (order.serviceType === "TABLE") {
      await connection.rollback();
      return { kind: "TABLE_ORDER_NOT_PREPAID" };
    }

    if (order.status !== "OPEN") {
      await connection.rollback();
      return { kind: "ORDER_NOT_OPEN" };
    }

    const existingBatch = await findOrderPaymentBatchWithConnection(
      connection,
      businessId,
      orderId,
    );

    if (existingBatch) {
      await connection.rollback();

      if (existingBatch.idempotencyKey === data.idempotencyKey) {
        return {
          kind: "RECORDED",
          created: false,
          paymentBatch: existingBatch,
        };
      }

      return { kind: "ORDER_ALREADY_PAID" };
    }

    const [idempotencyRows] = await connection.execute<OrderPaymentBatchRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            CAST(business_id AS CHAR) AS businessId,
            CAST(order_id AS CHAR) AS orderId,
            CAST(cash_session_id AS CHAR) AS cashSessionId,
            CAST(verified_by_membership_id AS CHAR)
              AS verifiedByMembershipId,
            CAST(sale_id AS CHAR) AS saleId,
            status,
            idempotency_key AS idempotencyKey,
            CAST(paid_total AS CHAR) AS paidTotal,
            CAST(change_total AS CHAR) AS changeTotal,
            verified_at AS verifiedAt,
            consumed_at AS consumedAt,
            refunded_at AS refundedAt,
            voided_at AS voidedAt,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM order_payment_batches
          WHERE
            business_id = ?
            AND idempotency_key = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, data.idempotencyKey],
    );

    if (idempotencyRows[0]) {
      await connection.rollback();
      return { kind: "IDEMPOTENCY_KEY_CONFLICT" };
    }

    const [cashSessionRows] = await connection.execute<CashSessionStateRow[]>(
      `
          SELECT
            CAST(cs.id AS CHAR) AS id,
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
      return { kind: "CASH_SESSION_NOT_FOUND" };
    }

    if (cashSession.status !== "OPEN") {
      await connection.rollback();
      return { kind: "CASH_SESSION_NOT_OPEN" };
    }

    if (cashSession.locationId !== order.locationId) {
      await connection.rollback();
      return { kind: "CASH_SESSION_LOCATION_MISMATCH" };
    }

    const resolvedPayments = [];

    for (const payment of data.payments) {
      const [methodRows] = await connection.execute<PaymentMethodStateRow[]>(
        `
            SELECT
              CAST(id AS CHAR) AS id,
              code,
              name,
              payment_type AS paymentType,
              requires_reference AS requiresReference,
              affects_cash AS affectsCash,
              allows_change AS allowsChange,
              is_active AS isActive
            FROM payment_methods
            WHERE
              business_id = ?
              AND id = ?
            LIMIT 1
            FOR UPDATE
          `,
        [businessId, payment.paymentMethodId],
      );

      const method = methodRows[0];

      if (!method?.isActive) {
        await connection.rollback();

        return {
          kind: "PAYMENT_METHOD_NOT_AVAILABLE",
          paymentMethodId: payment.paymentMethodId,
        };
      }

      if (method.requiresReference && !payment.reference) {
        await connection.rollback();

        return {
          kind: "PAYMENT_REFERENCE_REQUIRED",
          paymentMethodName: method.name,
        };
      }

      resolvedPayments.push({
        input: payment,
        method,
      });
    }

    const settlement = calculateSaleSettlement(
      order.total,
      resolvedPayments.map(({ input, method }) => ({
        amount: input.amount,
        tenderedAmount: input.tenderedAmount ?? input.amount,
        allowsChange: Boolean(method.allowsChange),
      })),
    );

    const [batchResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO order_payment_batches (
          business_id,
          order_id,
          cash_session_id,
          verified_by_membership_id,
          status,
          idempotency_key,
          paid_total,
          change_total,
          verified_at
        )
        VALUES (?, ?, ?, ?, 'VERIFIED', ?, ?, ?, CURRENT_TIMESTAMP(3))
      `,
      [
        businessId,
        orderId,
        data.cashSessionId,
        data.verifiedByMembershipId,
        data.idempotencyKey,
        settlement.paidTotal,
        settlement.changeTotal,
      ],
    );

    const paymentBatchId = batchResult.insertId.toString();

    for (const [index, resolvedPayment] of resolvedPayments.entries()) {
      const calculatedPayment = settlement.payments[index];

      if (!calculatedPayment) {
        throw new Error("No fue posible calcular el pago anticipado");
      }

      const { input, method } = resolvedPayment;

      const [paymentResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO order_payments (
            business_id,
            payment_batch_id,
            payment_method_id,
            processed_by_membership_id,
            payment_method_code,
            payment_method_name,
            payment_type,
            requires_reference,
            affects_cash,
            allows_change,
            amount,
            tendered_amount,
            change_amount,
            reference,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          businessId,
          paymentBatchId,
          method.id,
          data.verifiedByMembershipId,
          method.code,
          method.name,
          method.paymentType,
          method.requiresReference,
          method.affectsCash,
          method.allowsChange,
          calculatedPayment.amount,
          calculatedPayment.tenderedAmount,
          calculatedPayment.changeAmount,
          input.reference,
          input.notes,
        ],
      );

      if (method.affectsCash) {
        const orderPaymentId = paymentResult.insertId.toString();

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
                ?,
                ?,
                ?,
                'CASH_SALE',
                ?,
                ?,
                ?,
                'ORDER_PAYMENT',
                ?
              )
            `,
          [
            businessId,
            data.cashSessionId,
            data.verifiedByMembershipId,
            calculatedPayment.amount,
            `Pago anticipado del pedido ${orderId}`,
            input.reference,
            orderPaymentId,
          ],
        );

        await connection.execute<ResultSetHeader>(
          `
            UPDATE order_payments
            SET cash_movement_id = ?
            WHERE
              business_id = ?
              AND id = ?
          `,
          [cashMovementResult.insertId.toString(), businessId, orderPaymentId],
        );
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          payment_status = 'VERIFIED',
          payment_verified_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND payment_status = 'PENDING'
      `,
      [businessId, orderId],
    );

    const paymentBatch = await findOrderPaymentBatchWithConnection(
      connection,
      businessId,
      orderId,
    );

    if (!paymentBatch) {
      throw new Error("No fue posible recuperar el pago anticipado");
    }

    await connection.commit();

    return {
      kind: "RECORDED",
      created: true,
      paymentBatch,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { findOrderPaymentBatch, recordOrderPayment };

export type { RecordOrderPaymentResult };
