import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  PublicMenuConversionAmounts,
  PublicMenuConversionCounts,
  PublicMenuConversionFilters,
} from "../public-menu-conversion-report.types";

type PublicMenuConversionRow = RowDataPacket & {
  receivedRequests: string;
  contactedRequests: string;
  rejectedRequests: string;
  acceptedRequests: string;
  paidOrders: string;
  confirmedOrders: string;
  deliveredOrders: string;
  createdSales: string;
  completedSales: string;
  voidedSales: string;
  identifiedCustomers: string;
  grossSalesTotal: string;
  refundedTotal: string;
  effectiveSalesTotal: string;
};

type PublicMenuConversionResult = Readonly<{
  counts: PublicMenuConversionCounts;
  amounts: PublicMenuConversionAmounts;
}>;

const findPublicMenuConversion = async (
  businessId: string,
  filters: PublicMenuConversionFilters,
): Promise<PublicMenuConversionResult> => {
  const conditions = [
    "por.business_id = ?",
    "por.created_at >= ?",
    "por.created_at < ?",
  ];

  const values: string[] = [
    businessId,
    filters.period.start,
    filters.period.end,
  ];

  if (filters.locationId !== undefined) {
    conditions.push("por.location_id = ?");
    values.push(filters.locationId);
  }

  if (filters.serviceType !== undefined) {
    conditions.push("por.service_type = ?");
    values.push(filters.serviceType);
  }

  const whereClause = conditions.join("\n        AND ");

  const [rows] = await databasePool.execute<PublicMenuConversionRow[]>(
    `
      SELECT
        CAST(
          COUNT(DISTINCT por.id)
          AS CHAR
        ) AS receivedRequests,

        CAST(
          COUNT(
            DISTINCT CASE
              WHEN por.contacted_at IS NOT NULL
                THEN por.id
              ELSE NULL
            END
          )
          AS CHAR
        ) AS contactedRequests,

        CAST(
          COUNT(
            DISTINCT CASE
              WHEN por.status = 'REJECTED'
                THEN por.id
              ELSE NULL
            END
          )
          AS CHAR
        ) AS rejectedRequests,

        CAST(
          COUNT(
            DISTINCT CASE
              WHEN
                por.accepted_at IS NOT NULL
                AND por.order_id IS NOT NULL
                THEN por.id
              ELSE NULL
            END
          )
          AS CHAR
        ) AS acceptedRequests,

        CAST(
          COUNT(
            DISTINCT CASE
              WHEN o.payment_verified_at IS NOT NULL
                THEN o.id
              ELSE NULL
            END
          )
          AS CHAR
        ) AS paidOrders,

        CAST(
          COUNT(
            DISTINCT CASE
              WHEN o.confirmed_at IS NOT NULL
                THEN o.id
              ELSE NULL
            END
          )
          AS CHAR
        ) AS confirmedOrders,

        CAST(
          COUNT(
            DISTINCT CASE
              WHEN o.delivered_at IS NOT NULL
                THEN o.id
              ELSE NULL
            END
          )
          AS CHAR
        ) AS deliveredOrders,

        CAST(
          COUNT(DISTINCT s.id)
          AS CHAR
        ) AS createdSales,

        CAST(
          COUNT(
            DISTINCT CASE
              WHEN s.status <> 'VOIDED'
                THEN s.id
              ELSE NULL
            END
          )
          AS CHAR
        ) AS completedSales,

        CAST(
          COUNT(
            DISTINCT CASE
              WHEN s.status = 'VOIDED'
                THEN s.id
              ELSE NULL
            END
          )
          AS CHAR
        ) AS voidedSales,

        CAST(
          COUNT(DISTINCT por.commercial_customer_id)
          AS CHAR
        ) AS identifiedCustomers,

        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN s.status IS NULL THEN 0.00
                WHEN s.status = 'VOIDED' THEN 0.00
                ELSE s.total
              END
            ),
            0.00
          )
          AS CHAR
        ) AS grossSalesTotal,

        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN s.status IS NULL THEN 0.00
                WHEN s.status = 'VOIDED' THEN 0.00
                ELSE COALESCE(
                  refund_totals.refundedTotal,
                  0.00
                )
              END
            ),
            0.00
          )
          AS CHAR
        ) AS refundedTotal,

        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN s.status IS NULL THEN 0.00
                WHEN s.status = 'VOIDED' THEN 0.00
                ELSE
                  s.total - COALESCE(
                    refund_totals.refundedTotal,
                    0.00
                  )
              END
            ),
            0.00
          )
          AS CHAR
        ) AS effectiveSalesTotal

      FROM public_order_requests AS por

      LEFT JOIN orders AS o
        ON o.business_id = por.business_id
        AND o.id = por.order_id

      LEFT JOIN sales AS s
        ON s.business_id = por.business_id
        AND s.order_id = por.order_id

      LEFT JOIN (
        SELECT
          business_id,
          sale_id,
          SUM(total_amount) AS refundedTotal
        FROM sale_refunds
        GROUP BY
          business_id,
          sale_id
      ) AS refund_totals
        ON refund_totals.business_id = s.business_id
        AND refund_totals.sale_id = s.id

      WHERE ${whereClause}
    `,
    values,
  );

  const row = rows[0];

  if (!row) {
    throw new Error("No fue posible calcular la conversión del menú público");
  }

  return {
    counts: {
      receivedRequests: Number(row.receivedRequests),
      contactedRequests: Number(row.contactedRequests),
      rejectedRequests: Number(row.rejectedRequests),
      acceptedRequests: Number(row.acceptedRequests),
      paidOrders: Number(row.paidOrders),
      confirmedOrders: Number(row.confirmedOrders),
      deliveredOrders: Number(row.deliveredOrders),
      createdSales: Number(row.createdSales),
      completedSales: Number(row.completedSales),
      voidedSales: Number(row.voidedSales),
      identifiedCustomers: Number(row.identifiedCustomers),
    },

    amounts: {
      grossSalesTotal: row.grossSalesTotal,
      refundedTotal: row.refundedTotal,
      effectiveSalesTotal: row.effectiveSalesTotal,
    },
  };
};

export { findPublicMenuConversion };
