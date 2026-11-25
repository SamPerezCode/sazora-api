import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import type { SalesReportFilters } from "../sales-report.types";
import { buildFinancialSalesWhere } from "./sales-profitability.repository";

const MAX_SALES_EXPORT_ROWS = 20_000;

type SaleExportRow = RowDataPacket & {
  saleId: string;
  orderId: string;
  soldAtUtc: string;
  locationName: string;
  serviceType: string;
  sourceChannel: string;
  status: string;
  currencyCode: string;
  netBeforeRefunds: string;
  refundedNet: string;
  effectiveNet: string;
};

const findSalesExportRows = async (
  connection: PoolConnection,
  businessId: string,
  filters: SalesReportFilters,
): Promise<SaleExportRow[]> => {
  const { sql, values } = buildFinancialSalesWhere(businessId, filters);

  const [rows] = await connection.execute<SaleExportRow[]>(
    `
      WITH selected_sales AS (
        SELECT
          s.business_id, s.id, s.order_id, s.sold_at, s.location_id,
          s.service_type, s.source_channel, s.status, s.currency_code,
          s.net_subtotal - s.discount_total AS net_before_refunds
        FROM sales AS s
        INNER JOIN orders AS o
          ON o.business_id = s.business_id
          AND o.id = s.order_id
        WHERE ${sql}
        ORDER BY s.sold_at DESC, s.id DESC
        LIMIT ?
      ),
      refunds AS (
        SELECT sr.business_id, sr.sale_id, SUM(sr.net_amount) AS refunded_net
        FROM sale_refunds AS sr
        INNER JOIN selected_sales AS ss
          ON ss.business_id = sr.business_id
          AND ss.id = sr.sale_id
        GROUP BY sr.business_id, sr.sale_id
      )
      SELECT
        CAST(ss.id AS CHAR) AS saleId,
        CAST(ss.order_id AS CHAR) AS orderId,
        DATE_FORMAT(ss.sold_at, '%Y-%m-%dT%H:%i:%sZ') AS soldAtUtc,
        bl.name AS locationName,
        ss.service_type AS serviceType,
        ss.source_channel AS sourceChannel,
        ss.status,
        ss.currency_code AS currencyCode,
        CAST(ss.net_before_refunds AS CHAR) AS netBeforeRefunds,
        CAST(COALESCE(r.refunded_net, 0) AS CHAR) AS refundedNet,
        CAST(
          ss.net_before_refunds - COALESCE(r.refunded_net, 0) AS CHAR
        ) AS effectiveNet
      FROM selected_sales AS ss
      INNER JOIN business_locations AS bl
        ON bl.business_id = ss.business_id
        AND bl.id = ss.location_id
      LEFT JOIN refunds AS r
        ON r.business_id = ss.business_id
        AND r.sale_id = ss.id
      ORDER BY ss.sold_at DESC, ss.id DESC
    `,
    [...values, MAX_SALES_EXPORT_ROWS + 1],
  );

  return rows;
};

export { findSalesExportRows, MAX_SALES_EXPORT_ROWS };
