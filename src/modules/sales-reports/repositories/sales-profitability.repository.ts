import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { databasePool } from "../../../database/pool";
import type {
  SalesProfitability,
  SalesReportFilters,
} from "../sales-report.types";

type SalesProfitabilityRow = RowDataPacket &
  Omit<SalesProfitability, "dateBasis" | "unknownCostLineCount"> & {
    unknownCostLineCount: string;
  };

const buildFinancialSalesWhere = (
  businessId: string,
  filters: SalesReportFilters,
) => {
  const conditions = [
    "s.business_id = ?",
    "s.sold_at >= ?",
    "s.sold_at < ?",
    "s.status <> 'VOIDED'",
  ];

  const values = [businessId, filters.period.start, filters.period.end];

  if (filters.locationId !== undefined) {
    conditions.push("s.location_id = ?");
    values.push(filters.locationId);
  }

  if (filters.serviceType !== undefined) {
    conditions.push("s.service_type = ?");
    values.push(filters.serviceType);
  }

  if (filters.sourceChannel !== undefined) {
    conditions.push("s.source_channel = ?");
    values.push(filters.sourceChannel);
  }

  if (filters.openedByMembershipId !== undefined) {
    conditions.push("o.opened_by_membership_id = ?");
    values.push(filters.openedByMembershipId);
  }

  return { sql: conditions.join("\n          AND "), values };
};

const findSalesProfitability = async (
  businessId: string,
  filters: SalesReportFilters,
  connection?: PoolConnection,
): Promise<SalesProfitability> => {
  const { sql, values } = buildFinancialSalesWhere(businessId, filters);
  const executor = connection ?? databasePool;

  const [rows] = await executor.execute<SalesProfitabilityRow[]>(
    `
      WITH filtered_sales AS (
        SELECT s.business_id, s.id, s.net_subtotal, s.discount_total
        FROM sales AS s
        INNER JOIN orders AS o
          ON o.business_id = s.business_id
          AND o.id = s.order_id
        WHERE ${sql}),
      filtered_refunds AS (
        SELECT sr.business_id, sr.id, sr.net_amount
        FROM sale_refunds AS sr
        INNER JOIN filtered_sales AS fs
          ON fs.business_id = sr.business_id
          AND fs.id = sr.sale_id
      ),
      restored_costs AS (
        SELECT
          sri.business_id,
          sri.sale_item_id,
          SUM(sri.cost_amount) AS restored_cost,
          SUM(CASE WHEN sri.cost_amount IS NULL THEN 1 ELSE 0 END)
            AS unknown_cost_count
        FROM sale_refund_items AS sri
        INNER JOIN filtered_refunds AS fr
          ON fr.business_id = sri.business_id
          AND fr.id = sri.refund_id
        WHERE sri.restore_inventory = TRUE
          AND sri.inventory_movement_id IS NOT NULL
        GROUP BY sri.business_id, sri.sale_item_id
      ),
      inventory_costs AS (
        SELECT
          COALESCE(SUM(si.cost_total - COALESCE(rc.restored_cost, 0)), 0)
            AS cost_of_goods_sold,
          COUNT(
            CASE
              WHEN si.cost_total IS NULL OR rc.unknown_cost_count > 0 THEN 1
            END
          ) AS unknown_cost_line_count
        FROM sale_items AS si
        INNER JOIN filtered_sales AS fs
          ON fs.business_id = si.business_id
          AND fs.id = si.sale_id
        LEFT JOIN restored_costs AS rc
          ON rc.business_id = si.business_id
          AND rc.sale_item_id = si.id
      ),
      financial_totals AS (
        SELECT
          (
            SELECT COALESCE(SUM(net_subtotal - discount_total), 0)
            FROM filtered_sales
          ) AS net_sales,
          (
            SELECT COALESCE(SUM(net_amount), 0)
            FROM filtered_refunds
          ) AS refunded_net
      ),
      profitability AS (
        SELECT
          ft.net_sales,
          ft.refunded_net,
          ft.net_sales - ft.refunded_net AS effective_net_sales,
          ic.cost_of_goods_sold,
          ic.unknown_cost_line_count
        FROM financial_totals AS ft
        CROSS JOIN inventory_costs AS ic
      )
      SELECT
        CAST(net_sales AS CHAR) AS netSalesBeforeRefunds,
        CAST(refunded_net AS CHAR) AS refundedNetAmount,
        CAST(effective_net_sales AS CHAR) AS effectiveNetSales,
        CAST(
          CASE WHEN unknown_cost_line_count = 0 THEN cost_of_goods_sold END
          AS CHAR
        ) AS costOfGoodsSold,
        CAST(
          CASE
            WHEN unknown_cost_line_count = 0
            THEN effective_net_sales - cost_of_goods_sold
          END AS CHAR
        ) AS grossProfit,
        CAST(
          CASE
            WHEN unknown_cost_line_count = 0 AND effective_net_sales > 0
            THEN ROUND(
              (effective_net_sales - cost_of_goods_sold)
                * 100 / NULLIF(effective_net_sales, 0),
              2
            )
          END AS CHAR
        ) AS grossMarginPercentage,
        CAST(unknown_cost_line_count AS CHAR) AS unknownCostLineCount
      FROM profitability
    `,
    values,
  );

  const row = rows[0];

  if (!row) {
    throw new Error("No fue posible calcular la rentabilidad de las ventas");
  }

  return {
    dateBasis: "SOLD_AT",
    netSalesBeforeRefunds: row.netSalesBeforeRefunds,
    refundedNetAmount: row.refundedNetAmount,
    effectiveNetSales: row.effectiveNetSales,
    costOfGoodsSold: row.costOfGoodsSold,
    grossProfit: row.grossProfit,
    grossMarginPercentage: row.grossMarginPercentage,
    unknownCostLineCount: Number(row.unknownCostLineCount),
  };
};

export { buildFinancialSalesWhere, findSalesProfitability };
