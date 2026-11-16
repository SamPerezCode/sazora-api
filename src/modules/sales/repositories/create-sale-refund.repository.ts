import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import {
  decimalToScaledBigInt,
  scaledBigIntToDecimal,
} from "../../../shared/math/fixed-decimal";
import {
  calculateRefundItemMoney,
  centsToMoney,
  databaseMoneyToExactCents,
  inputMoneyToCents,
} from "../sale-refund-calculation";
import type { SaleStatus } from "../sale.types";
import type { CreateSaleRefundData } from "../sale-refund.types";
import { restoreSaleRefundInventory } from "./restore-sale-refund-inventory.repository";

interface SaleStateRow extends RowDataPacket {
  locationId: string;
  status: SaleStatus;
}

interface CashSessionStateRow extends RowDataPacket {
  locationId: string;
  status: "OPEN" | "CLOSED";
}

interface SaleItemStateRow extends RowDataPacket {
  id: string;
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  refundedQuantity: string;
  lineTaxTotal: string;
  lineTotal: string;
  costTotal: string | null;
  refundedTaxAmount: string;
  refundedTotalAmount: string;
  refundedCostAmount: string | null;
}

interface SalePaymentStateRow extends RowDataPacket {
  id: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: string;
  requiresReference: number;
  affectsCash: number;
  amount: string;
  refundedAmount: string;
}

interface CashBalanceRow extends RowDataPacket {
  expectedCashAmount: string;
}

interface RemainingQuantityRow extends RowDataPacket {
  remainingQuantity: string;
}

interface SaleItemStateRow extends RowDataPacket {
  id: string;
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  refundedQuantity: string;
  lineTaxTotal: string;
  lineTotal: string;
  costTotal: string | null;
  refundedTaxAmount: string;
  refundedTotalAmount: string;
  refundedCostAmount: string | null;
}

type CreateSaleRefundResult =
  | Readonly<{
      kind: "CREATED";
      refundId: string;
    }>
  | Readonly<{ kind: "SALE_NOT_FOUND" }>
  | Readonly<{
      kind: "SALE_NOT_REFUNDABLE";
      status: SaleStatus;
    }>
  | Readonly<{ kind: "CASH_SESSION_NOT_FOUND" }>
  | Readonly<{ kind: "CASH_SESSION_NOT_OPEN" }>
  | Readonly<{ kind: "CASH_SESSION_LOCATION_MISMATCH" }>
  | Readonly<{
      kind: "SALE_ITEM_NOT_FOUND";
      saleItemId: string;
    }>
  | Readonly<{
      kind: "REFUND_QUANTITY_EXCEEDED";
      saleItemId: string;
      availableQuantity: number;
    }>
  | Readonly<{
      kind: "SALE_PAYMENT_NOT_FOUND";
      salePaymentId: string;
    }>
  | Readonly<{
      kind: "REFUND_PAYMENT_EXCEEDED";
      salePaymentId: string;
      availableAmount: string;
    }>
  | Readonly<{
      kind: "PAYMENT_REFERENCE_REQUIRED";
      salePaymentId: string;
    }>
  | Readonly<{
      kind: "REFUND_TOTAL_MISMATCH";
      expectedTotal: string;
      receivedTotal: string;
    }>
  | Readonly<{
      kind: "LEGACY_SUBCENT_PAYMENT";
      salePaymentId: string;
      originalAmount: string;
      refundedAmount: string;
    }>
  | Readonly<{
      kind: "INSUFFICIENT_CASH";
      expectedCashAmount: string;
      requiredCashAmount: string;
    }>;

const COST_SCALE = 6;

const allocateInternalAmount = (
  originalAmount: bigint,
  refundedAmount: bigint,
  originalQuantity: number,
  availableQuantity: number,
  requestedQuantity: number,
): bigint => {
  if (requestedQuantity === availableQuantity) {
    return originalAmount - refundedAmount;
  }

  return (
    (originalAmount * BigInt(requestedQuantity)) / BigInt(originalQuantity)
  );
};
const createSaleRefundRecord = async (
  businessId: string,
  saleId: string,
  data: CreateSaleRefundData,
): Promise<CreateSaleRefundResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [saleRows] = await connection.execute<SaleStateRow[]>(
      `
        SELECT
          CAST(location_id AS CHAR) AS locationId,
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
      return { kind: "SALE_NOT_FOUND" };
    }

    if (sale.status !== "COMPLETED" && sale.status !== "PARTIALLY_REFUNDED") {
      await connection.rollback();

      return {
        kind: "SALE_NOT_REFUNDABLE",
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
      [businessId, data.cashSessionId],
    );

    const cashSession = sessionRows[0];

    if (!cashSession) {
      await connection.rollback();
      return { kind: "CASH_SESSION_NOT_FOUND" };
    }

    if (cashSession.status !== "OPEN") {
      await connection.rollback();
      return { kind: "CASH_SESSION_NOT_OPEN" };
    }

    if (cashSession.locationId !== sale.locationId) {
      await connection.rollback();
      return { kind: "CASH_SESSION_LOCATION_MISMATCH" };
    }

    const preparedItems: {
      state: SaleItemStateRow;
      quantity: number;
      restoreInventory: boolean;
      netAmount: bigint;
      taxAmount: bigint;
      totalAmount: bigint;
      costAmount: bigint | null;
    }[] = [];

    for (const requestedItem of data.items) {
      const [itemRows] = await connection.execute<SaleItemStateRow[]>(
        `
          SELECT
            CAST(si.id AS CHAR) AS id,
            CAST(si.order_item_id AS CHAR) AS orderItemId,
            CAST(si.product_id AS CHAR) AS productId,
            si.product_name AS productName,
            si.quantity,
            CAST(
              COALESCE(
                (
                  SELECT SUM(sri.quantity)
                  FROM sale_refund_items AS sri
                  INNER JOIN sale_refunds AS sr
                    ON sr.business_id = sri.business_id
                    AND sr.id = sri.refund_id
                  WHERE
                    sri.business_id = si.business_id
                    AND sri.sale_item_id = si.id
                ),
                0
              )
              AS CHAR
            ) AS refundedQuantity,
            CAST(si.line_tax_total AS CHAR) AS lineTaxTotal,
            CAST(si.line_total AS CHAR) AS lineTotal,
            CAST(si.cost_total AS CHAR) AS costTotal,
            CAST(
              COALESCE(
                (
                  SELECT SUM(sri.tax_amount)
                  FROM sale_refund_items AS sri
                  WHERE
                    sri.business_id = si.business_id
                    AND sri.sale_item_id = si.id
                ),
                0
              )
              AS CHAR
            ) AS refundedTaxAmount,
            CAST(
              COALESCE(
                (
                  SELECT SUM(sri.total_amount)
                  FROM sale_refund_items AS sri
                  WHERE
                    sri.business_id = si.business_id
                    AND sri.sale_item_id = si.id
                ),
                0
              )
              AS CHAR
            ) AS refundedTotalAmount,
            CAST(
              (
                SELECT SUM(sri.cost_amount)
                FROM sale_refund_items AS sri
                WHERE
                  sri.business_id = si.business_id
                  AND sri.sale_item_id = si.id
              )
              AS CHAR
            ) AS refundedCostAmount
          FROM sale_items AS si
          WHERE
            si.business_id = ?
            AND si.sale_id = ?
            AND si.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [businessId, saleId, requestedItem.saleItemId],
      );

      const item = itemRows[0];

      if (!item) {
        await connection.rollback();

        return {
          kind: "SALE_ITEM_NOT_FOUND",
          saleItemId: requestedItem.saleItemId,
        };
      }

      const refundedQuantity = Number(item.refundedQuantity);
      const availableQuantity = item.quantity - refundedQuantity;

      if (requestedItem.quantity > availableQuantity) {
        await connection.rollback();

        return {
          kind: "REFUND_QUANTITY_EXCEEDED",
          saleItemId: item.id,
          availableQuantity,
        };
      }

      const refundMoney = calculateRefundItemMoney({
        originalTotalAmount: item.lineTotal,
        originalTaxAmount: item.lineTaxTotal,
        refundedTotalAmount: item.refundedTotalAmount,
        refundedTaxAmount: item.refundedTaxAmount,
        originalQuantity: item.quantity,
        availableQuantity,
        requestedQuantity: requestedItem.quantity,
      });

      const originalCost =
        item.costTotal === null
          ? null
          : decimalToScaledBigInt(item.costTotal, COST_SCALE);

      const refundedCost =
        item.refundedCostAmount === null
          ? 0n
          : decimalToScaledBigInt(item.refundedCostAmount, COST_SCALE);

      const costAmount =
        originalCost === null
          ? null
          : allocateInternalAmount(
              originalCost,
              refundedCost,
              item.quantity,
              availableQuantity,
              requestedItem.quantity,
            );

      preparedItems.push({
        state: item,
        quantity: requestedItem.quantity,
        restoreInventory: requestedItem.restoreInventory,
        netAmount: refundMoney.netAmountCents,
        taxAmount: refundMoney.taxAmountCents,
        totalAmount: refundMoney.totalAmountCents,
        costAmount,
      });
    }

    const refundNetAmount = preparedItems.reduce(
      (total, item) => total + item.netAmount,
      0n,
    );

    const refundTaxAmount = preparedItems.reduce(
      (total, item) => total + item.taxAmount,
      0n,
    );

    const refundTotalAmount = preparedItems.reduce(
      (total, item) => total + item.totalAmount,
      0n,
    );

    if (refundNetAmount + refundTaxAmount !== refundTotalAmount) {
      throw new Error(
        "La distribución del reembolso no conserva neto, impuesto y total",
      );
    }

    const hasUnknownCost = preparedItems.some(
      (item) => item.costAmount === null,
    );

    const refundCostAmount = hasUnknownCost
      ? null
      : preparedItems.reduce(
          (total, item) => total + (item.costAmount ?? 0n),
          0n,
        );

    const preparedPayments: {
      state: SalePaymentStateRow;
      amount: bigint;
      reference: string | null;
      notes: string | null;
    }[] = [];

    for (const requestedPayment of data.payments) {
      const [paymentRows] = await connection.execute<SalePaymentStateRow[]>(
        `
            SELECT
              CAST(sp.id AS CHAR) AS id,
              sp.payment_method_code AS paymentMethodCode,
              sp.payment_method_name AS paymentMethodName,
              sp.payment_type AS paymentType,
              sp.requires_reference AS requiresReference,
              sp.affects_cash AS affectsCash,
              CAST(sp.amount AS CHAR) AS amount,
              CAST(
                COALESCE(
                  (
                    SELECT SUM(srp.amount)
                    FROM sale_refund_payments AS srp
                    INNER JOIN sale_refunds AS sr
                      ON sr.business_id = srp.business_id
                      AND sr.id = srp.refund_id
                    WHERE
                      srp.business_id = sp.business_id
                      AND sr.sale_id = sp.sale_id
                      AND srp.sale_payment_id = sp.id
                  ),
                  0
                )
                AS CHAR
              ) AS refundedAmount
            FROM sale_payments AS sp
            WHERE
              sp.business_id = ?
              AND sp.sale_id = ?
              AND sp.id = ?
            LIMIT 1
            FOR UPDATE
          `,
        [businessId, saleId, requestedPayment.salePaymentId],
      );

      const payment = paymentRows[0];

      if (!payment) {
        await connection.rollback();

        return {
          kind: "SALE_PAYMENT_NOT_FOUND",
          salePaymentId: requestedPayment.salePaymentId,
        };
      }

      if (payment.requiresReference && requestedPayment.reference === null) {
        await connection.rollback();

        return {
          kind: "PAYMENT_REFERENCE_REQUIRED",
          salePaymentId: payment.id,
        };
      }

      const originalAmount = databaseMoneyToExactCents(payment.amount);

      const refundedAmount = databaseMoneyToExactCents(payment.refundedAmount);

      if (originalAmount === null || refundedAmount === null) {
        await connection.rollback();

        return {
          kind: "LEGACY_SUBCENT_PAYMENT",
          salePaymentId: payment.id,
          originalAmount: payment.amount,
          refundedAmount: payment.refundedAmount,
        };
      }

      const requestedAmount = inputMoneyToCents(requestedPayment.amount);

      const availableAmount = originalAmount - refundedAmount;

      if (requestedAmount > availableAmount) {
        await connection.rollback();

        return {
          kind: "REFUND_PAYMENT_EXCEEDED",
          salePaymentId: payment.id,
          availableAmount: centsToMoney(availableAmount),
        };
      }

      preparedPayments.push({
        state: payment,
        amount: requestedAmount,
        reference: requestedPayment.reference,
        notes: requestedPayment.notes,
      });
    }

    const receivedTotal = preparedPayments.reduce(
      (total, payment) => total + payment.amount,
      0n,
    );

    if (receivedTotal !== refundTotalAmount) {
      await connection.rollback();

      return {
        kind: "REFUND_TOTAL_MISMATCH",
        expectedTotal: centsToMoney(refundTotalAmount),
        receivedTotal: centsToMoney(receivedTotal),
      };
    }

    const cashRefundAmount = preparedPayments
      .filter((payment) => Boolean(payment.state.affectsCash))
      .reduce((total, payment) => total + payment.amount, 0n);

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
        [businessId, data.cashSessionId],
      );

      const expectedCashAmount = balanceRows[0]?.expectedCashAmount ?? "0.00";

      const expectedCashCents = databaseMoneyToExactCents(expectedCashAmount);

      if (expectedCashCents === null) {
        throw new Error(
          `La caja contiene un saldo subcentavo incompatible: ${expectedCashAmount}`,
        );
      }

      if (expectedCashCents < cashRefundAmount) {
        await connection.rollback();

        return {
          kind: "INSUFFICIENT_CASH",
          expectedCashAmount: centsToMoney(expectedCashCents),
          requiredCashAmount: centsToMoney(cashRefundAmount),
        };
      }
    }

    const [remainingRows] = await connection.execute<RemainingQuantityRow[]>(
      `
          SELECT
            CAST(
              COALESCE(
                SUM(
                  si.quantity -
                  COALESCE(
                    (
                      SELECT SUM(sri.quantity)
                      FROM sale_refund_items AS sri
                      WHERE
                        sri.business_id = si.business_id
                        AND sri.sale_item_id = si.id
                    ),
                    0
                  )
                ),
                0
              )
              AS CHAR
            ) AS remainingQuantity
          FROM sale_items AS si
          WHERE
            si.business_id = ?
            AND si.sale_id = ?
        `,
      [businessId, saleId],
    );

    const remainingQuantity = Number(
      remainingRows[0]?.remainingQuantity ?? "0",
    );

    const requestedQuantity = preparedItems.reduce(
      (total, item) => total + item.quantity,
      0,
    );

    const refundKind =
      requestedQuantity === remainingQuantity ? "FULL" : "PARTIAL";

    const [refundResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO sale_refunds (
          business_id,
          sale_id,
          cash_session_id,
          processed_by_membership_id,
          refund_kind,
          reason,
          net_amount,
          tax_amount,
          total_amount,
          cost_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        businessId,
        saleId,
        data.cashSessionId,
        data.processedByMembershipId,
        refundKind,
        data.reason,
        centsToMoney(refundNetAmount),
        centsToMoney(refundTaxAmount),
        centsToMoney(refundTotalAmount),
        refundCostAmount === null
          ? null
          : scaledBigIntToDecimal(refundCostAmount, COST_SCALE),
      ],
    );

    const refundId = refundResult.insertId.toString();

    for (const item of preparedItems) {
      const [itemResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO sale_refund_items (
            business_id,
            refund_id,
            sale_item_id,
            product_id,
            product_name,
            quantity,
            restore_inventory,
            inventory_movement_id,
            net_amount,
            tax_amount,
            total_amount,
            cost_amount
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
        `,
        [
          businessId,
          refundId,
          item.state.id,
          item.state.productId,
          item.state.productName,
          item.quantity,
          item.restoreInventory,
          centsToMoney(item.netAmount),
          centsToMoney(item.taxAmount),
          centsToMoney(item.totalAmount),
          item.costAmount === null
            ? null
            : scaledBigIntToDecimal(item.costAmount, COST_SCALE),
        ],
      );

      if (!item.restoreInventory) {
        continue;
      }

      const refundItemId = itemResult.insertId.toString();

      const movementId = await restoreSaleRefundInventory(
        connection,
        businessId,
        data.processedByMembershipId,
        refundId,
        refundItemId,
        item.state.id,
        item.state.orderItemId,
        sale.locationId,
        item.state.quantity,
        item.quantity,
        `Devolución ${refundId}: ${data.reason}`,
      );

      if (movementId) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE sale_refund_items
            SET inventory_movement_id = ?
            WHERE
              business_id = ?
              AND id = ?
          `,
          [movementId, businessId, refundItemId],
        );
      }
    }

    for (const payment of preparedPayments) {
      const [paymentResult] = await connection.execute<ResultSetHeader>(
        `
            INSERT INTO sale_refund_payments (
              business_id,
              refund_id,
              sale_payment_id,
              processed_by_membership_id,
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
              ?, ?, ?, ?, NULL,
              ?, ?, ?, ?, ?, ?, ?, ?
            )
          `,
        [
          businessId,
          refundId,
          payment.state.id,
          data.processedByMembershipId,
          payment.state.paymentMethodCode,
          payment.state.paymentMethodName,
          payment.state.paymentType,
          payment.state.requiresReference,
          payment.state.affectsCash,
          centsToMoney(payment.amount),
          payment.reference,
          payment.notes,
        ],
      );

      if (!payment.state.affectsCash) {
        continue;
      }

      const refundPaymentId = paymentResult.insertId.toString();

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
              ?, ?, ?,
              'CASH_REFUND',
              ?, ?, ?,
              'REFUND_PAYMENT',
              ?
            )
          `,
        [
          businessId,
          data.cashSessionId,
          data.processedByMembershipId,
          centsToMoney(payment.amount),
          `Devolución ${refundId}: ${data.reason}`,
          payment.reference,
          refundPaymentId,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE sale_refund_payments
          SET cash_movement_id = ?
          WHERE
            business_id = ?
            AND id = ?
        `,
        [movementResult.insertId.toString(), businessId, refundPaymentId],
      );
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE sales
        SET status = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        refundKind === "FULL" ? "REFUNDED" : "PARTIALLY_REFUNDED",
        businessId,
        saleId,
      ],
    );

    await connection.commit();

    return {
      kind: "CREATED",
      refundId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createSaleRefundRecord };
export type { CreateSaleRefundResult };
