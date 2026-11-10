import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { CreateSaleData } from "../sale.types";

interface OrderSaleStateRow extends RowDataPacket {
  id: string;
  locationId: string;
  status: "OPEN" | "CONFIRMED" | "DELIVERED" | "CLOSED" | "CANCELLED";
  netSubtotal: string;
  taxTotal: string;
  total: string;
}

interface ExistingSaleRow extends RowDataPacket {
  id: string;
}

interface CashSessionStateRow extends RowDataPacket {
  id: string;
  locationId: string;
  status: "OPEN" | "CLOSED";
  currencyCode: string;
}

interface CustomerStateRow extends RowDataPacket {
  id: string;
  isActive: number;
}

interface PaymentMethodStateRow extends RowDataPacket {
  id: string;
  isActive: number;
}

interface CreatedSaleRecord {
  saleId: string;
}

type CreateSaleResult =
  | Readonly<{
      kind: "CREATED";
      saleId: string;
    }>
  | Readonly<{
      kind: "ORDER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_DELIVERED";
    }>
  | Readonly<{
      kind: "SALE_ALREADY_EXISTS";
      saleId: string;
    }>
  | Readonly<{
      kind: "CASH_SESSION_NOT_FOUND";
    }>
  | Readonly<{
      kind: "CASH_SESSION_NOT_OPEN";
    }>
  | Readonly<{
      kind: "CASH_SESSION_LOCATION_MISMATCH";
    }>
  | Readonly<{
      kind: "CUSTOMER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "CUSTOMER_NOT_ACTIVE";
    }>
  | Readonly<{
      kind: "PAYMENT_METHOD_NOT_AVAILABLE";
      paymentMethodId: string;
    }>
  | Readonly<{
      kind: "SALE_TOTAL_CHANGED";
      expectedTotal: string;
      receivedTotal: string;
    }>;

const findOrderSaleState = async (
  businessId: string,
  orderId: string,
): Promise<OrderSaleStateRow | null> => {
  const [rows] = await databasePool.execute<OrderSaleStateRow[]>(
    `
      SELECT
        CAST(o.id AS CHAR) AS id,
        CAST(o.location_id AS CHAR) AS locationId,
        o.status,
        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN oi.status = 'ACTIVE'
                  THEN oi.line_net_total
                ELSE 0
              END
            ),
            0
          )
          AS CHAR
        ) AS netSubtotal,
        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN oi.status = 'ACTIVE'
                  THEN oi.line_tax_total
                ELSE 0
              END
            ),
            0
          )
          AS CHAR
        ) AS taxTotal,
        CAST(
          ROUND(
            COALESCE(
              SUM(
                CASE
                  WHEN oi.status = 'ACTIVE'
                    THEN oi.line_total
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
        o.status
      LIMIT 1
    `,
    [businessId, orderId],
  );

  return rows[0] ?? null;
};

const createSaleRecord = async (
  businessId: string,
  data: CreateSaleData,
): Promise<CreateSaleResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute<OrderSaleStateRow[]>(
      `
        SELECT
          CAST(o.id AS CHAR) AS id,
          CAST(o.location_id AS CHAR) AS locationId,
          o.status,
          CAST(
            COALESCE(
              SUM(
                CASE
                  WHEN oi.status = 'ACTIVE'
                    THEN oi.line_net_total
                  ELSE 0
                END
              ),
              0
            )
            AS CHAR
          ) AS netSubtotal,
          CAST(
            COALESCE(
              SUM(
                CASE
                  WHEN oi.status = 'ACTIVE'
                    THEN oi.line_tax_total
                  ELSE 0
                END
              ),
              0
            )
            AS CHAR
          ) AS taxTotal,
          CAST(
            ROUND(
              COALESCE(
                SUM(
                  CASE
                    WHEN oi.status = 'ACTIVE'
                      THEN oi.line_total
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
          o.status
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, data.orderId],
    );

    const order = orderRows[0];

    if (!order) {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_FOUND",
      };
    }

    const [existingSaleRows] = await connection.execute<ExistingSaleRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
        FROM sales
        WHERE
          business_id = ?
          AND order_id = ?
        LIMIT 1
      `,
      [businessId, data.orderId],
    );

    const existingSale = existingSaleRows[0];

    if (existingSale) {
      await connection.rollback();

      return {
        kind: "SALE_ALREADY_EXISTS",
        saleId: existingSale.id,
      };
    }

    if (order.status !== "DELIVERED") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_DELIVERED",
      };
    }

    if (Number(order.total) !== Number(data.paidTotal)) {
      await connection.rollback();

      return {
        kind: "SALE_TOTAL_CHANGED",
        expectedTotal: order.total,
        receivedTotal: data.paidTotal,
      };
    }

    const [cashSessionRows] = await connection.execute<CashSessionStateRow[]>(
      `
          SELECT
            CAST(cs.id AS CHAR) AS id,
            CAST(cr.location_id AS CHAR) AS locationId,
            cs.status,
            cs.currency_code AS currencyCode
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

    if (data.commercialCustomerId) {
      const [customerRows] = await connection.execute<CustomerStateRow[]>(
        `
          SELECT
            CAST(id AS CHAR) AS id,
            is_active AS isActive
          FROM commercial_customers
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [businessId, data.commercialCustomerId],
      );

      const customer = customerRows[0];

      if (!customer) {
        await connection.rollback();

        return {
          kind: "CUSTOMER_NOT_FOUND",
        };
      }

      if (!customer.isActive) {
        await connection.rollback();

        return {
          kind: "CUSTOMER_NOT_ACTIVE",
        };
      }
    }

    for (const payment of data.payments) {
      const [paymentMethodRows] = await connection.execute<
        PaymentMethodStateRow[]
      >(
        `
            SELECT
              CAST(id AS CHAR) AS id,
              is_active AS isActive
            FROM payment_methods
            WHERE
              business_id = ?
              AND id = ?
            LIMIT 1
            FOR UPDATE
          `,
        [businessId, payment.paymentMethod.id],
      );

      const paymentMethod = paymentMethodRows[0];

      if (!paymentMethod?.isActive) {
        await connection.rollback();

        return {
          kind: "PAYMENT_METHOD_NOT_AVAILABLE",
          paymentMethodId: payment.paymentMethod.id,
        };
      }
    }

    const [saleInsertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO sales (
          business_id,
          location_id,
          order_id,
          cash_session_id,
          commercial_customer_id,
          sold_by_membership_id,
          status,
          currency_code,
          net_subtotal,
          tax_total,
          discount_total,
          tip_total,
          total,
          paid_total,
          change_total
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'COMPLETED',
          ?,
          ?,
          ?,
          0.000000,
          0.000000,
          ?,
          ?,
          ?
        )
      `,
      [
        businessId,
        order.locationId,
        data.orderId,
        data.cashSessionId,
        data.commercialCustomerId,
        data.soldByMembershipId,
        cashSession.currencyCode,
        order.netSubtotal,
        order.taxTotal,
        order.total,
        data.paidTotal,
        data.changeTotal,
      ],
    );

    const createdSale: CreatedSaleRecord = {
      saleId: saleInsertResult.insertId.toString(),
    };

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO sale_items (
          business_id,
          sale_id,
          order_item_id,
          product_id,
          category_id,
          preparation_area_id,
          tax_class_id,
          product_name,
          category_name,
          preparation_area_name,
          quantity,
          unit_price,
          tax_code,
          tax_name,
          tax_type,
          tax_rate,
          price_includes_tax,
          unit_net_price,
          unit_tax_amount,
          discount_amount,
          line_net_total,
          line_tax_total,
          line_total,
          cost_total,
          gross_profit_amount
        )
        SELECT
          oi.business_id,
          ?,
          oi.id,
          oi.product_id,
          p.category_id,
          oi.preparation_area_id,
          oi.tax_class_id,
          oi.product_name,
          c.name,
          pa.name,
          oi.quantity,
          oi.unit_price,
          oi.tax_code,
          oi.tax_name,
          oi.tax_type,
          oi.tax_rate,
          oi.price_includes_tax,
          oi.unit_net_price,
          oi.unit_tax_amount,
          0.000000,
          oi.line_net_total,
          oi.line_tax_total,
          oi.line_total,
          NULL,
          NULL
        FROM order_items AS oi
        INNER JOIN products AS p
          ON p.business_id = oi.business_id
          AND p.id = oi.product_id
        LEFT JOIN categories AS c
          ON c.business_id = p.business_id
          AND c.id = p.category_id
        LEFT JOIN preparation_areas AS pa
          ON pa.business_id = oi.business_id
          AND pa.id = oi.preparation_area_id
        WHERE
          oi.business_id = ?
          AND oi.order_id = ?
          AND oi.status = 'ACTIVE'
        ORDER BY oi.id ASC
      `,
      [createdSale.saleId, businessId, data.orderId],
    );

    for (const payment of data.payments) {
      const method = payment.paymentMethod;

      const [paymentInsertResult] = await connection.execute<ResultSetHeader>(
        `
            INSERT INTO sale_payments (
              business_id,
              sale_id,
              payment_method_id,
              processed_by_membership_id,
              cash_movement_id,
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
            VALUES (
              ?,
              ?,
              ?,
              ?,
              NULL,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?
            )
          `,
        [
          businessId,
          createdSale.saleId,
          method.id,
          data.soldByMembershipId,
          method.code,
          method.name,
          method.paymentType,
          method.requiresReference,
          method.affectsCash,
          method.allowsChange,
          payment.amount,
          payment.tenderedAmount,
          payment.changeAmount,
          payment.reference,
          payment.notes,
        ],
      );

      if (method.affectsCash) {
        const salePaymentId = paymentInsertResult.insertId.toString();

        const [cashMovementInsertResult] =
          await connection.execute<ResultSetHeader>(
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
                'SALE_PAYMENT',
                ?
              )
            `,
            [
              businessId,
              data.cashSessionId,
              data.soldByMembershipId,
              payment.amount,
              `Pago en efectivo de la venta ${createdSale.saleId}`,
              payment.reference,
              salePaymentId,
            ],
          );

        await connection.execute<ResultSetHeader>(
          `
            UPDATE sale_payments
            SET cash_movement_id = ?
            WHERE
              business_id = ?
              AND id = ?
          `,
          [
            cashMovementInsertResult.insertId.toString(),
            businessId,
            salePaymentId,
          ],
        );
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          status = 'CLOSED',
          closed_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'DELIVERED'
      `,
      [businessId, data.orderId],
    );

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO order_status_history (
          business_id,
          order_id,
          changed_by_membership_id,
          previous_status,
          new_status,
          reason
        )
        VALUES (
          ?,
          ?,
          ?,
          'DELIVERED',
          'CLOSED',
          'Orden cerrada mediante una venta pagada'
        )
      `,
      [businessId, data.orderId, data.soldByMembershipId],
    );

    await connection.commit();

    return {
      kind: "CREATED",
      saleId: createdSale.saleId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createSaleRecord, findOrderSaleState };

export type { CreateSaleResult, OrderSaleStateRow };
