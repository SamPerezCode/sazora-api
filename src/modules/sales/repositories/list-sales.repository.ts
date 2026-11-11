import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { LocationType } from "../../locations/location.types";
import type {
  ListSalesFilters,
  SaleListItem,
  SaleListResult,
  SaleStatus,
} from "../sale.types";

interface SaleListRow extends RowDataPacket {
  id: string;
  businessId: string;
  locationId: string;
  orderId: string;
  cashSessionId: string;
  commercialCustomerId: string | null;
  customerName: string | null;
  soldByMembershipId: string;
  soldByName: string;
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  status: SaleStatus;
  currencyCode: string;
  itemCount: string;
  unitsSold: string;
  netSubtotal: string;
  taxTotal: string;
  discountTotal: string;
  tipTotal: string;
  total: string;
  paidTotal: string;
  changeTotal: string;
  refundCount: string;
  refundedNetAmount: string;
  refundedTaxAmount: string;
  refundedTotalAmount: string;
  voidedAmount: string;
  effectiveNetAmount: string;
  effectiveTaxAmount: string;
  effectiveTotalAmount: string;
  voidedByMembershipId: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
  soldAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface SaleCountRow extends RowDataPacket {
  total: string;
}

const mapSaleListRow = (row: SaleListRow): SaleListItem => ({
  id: row.id,
  businessId: row.businessId,
  locationId: row.locationId,
  orderId: row.orderId,
  cashSessionId: row.cashSessionId,
  commercialCustomerId: row.commercialCustomerId,
  customerName: row.customerName,
  soldByMembershipId: row.soldByMembershipId,

  soldBy: {
    membershipId: row.soldByMembershipId,
    fullName: row.soldByName,
  },

  location: {
    id: row.locationId,
    code: row.locationCode,
    name: row.locationName,
    locationType: row.locationType,
  },

  status: row.status,
  currencyCode: row.currencyCode,

  itemCount: Number(row.itemCount),
  unitsSold: Number(row.unitsSold),

  netSubtotal: row.netSubtotal,
  taxTotal: row.taxTotal,
  discountTotal: row.discountTotal,
  tipTotal: row.tipTotal,
  total: row.total,
  paidTotal: row.paidTotal,
  changeTotal: row.changeTotal,

  refundCount: Number(row.refundCount),
  refundedNetAmount: row.refundedNetAmount,
  refundedTaxAmount: row.refundedTaxAmount,
  refundedTotalAmount: row.refundedTotalAmount,

  voidedAmount: row.voidedAmount,
  effectiveNetAmount: row.effectiveNetAmount,
  effectiveTaxAmount: row.effectiveTaxAmount,
  effectiveTotalAmount: row.effectiveTotalAmount,

  voidedByMembershipId: row.voidedByMembershipId,

  voidedBy:
    row.voidedByMembershipId === null || row.voidedByName === null
      ? null
      : {
          membershipId: row.voidedByMembershipId,
          fullName: row.voidedByName,
        },

  voidReason: row.voidReason,
  voidedAt: row.voidedAt,
  soldAt: row.soldAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findSales = async (
  businessId: string,
  filters: ListSalesFilters,
): Promise<SaleListResult> => {
  const connection = await databasePool.getConnection();

  const conditions = ["s.business_id = ?"];
  const parameters: (string | number | Date)[] = [businessId];

  if (filters.locationId !== undefined) {
    conditions.push("s.location_id = ?");
    parameters.push(filters.locationId);
  }

  if (filters.cashSessionId !== undefined) {
    conditions.push("s.cash_session_id = ?");
    parameters.push(filters.cashSessionId);
  }

  if (filters.status !== undefined) {
    conditions.push("s.status = ?");
    parameters.push(filters.status);
  }

  if (filters.from !== undefined) {
    conditions.push("s.sold_at >= ?");
    parameters.push(filters.from);
  }

  if (filters.to !== undefined) {
    conditions.push("s.sold_at <= ?");
    parameters.push(filters.to);
  }

  const whereClause = conditions.join("\n          AND ");
  const offset = (filters.page - 1) * filters.pageSize;

  try {
    await connection.beginTransaction();

    const [countRows] = await connection.execute<SaleCountRow[]>(
      `
        SELECT CAST(COUNT(*) AS CHAR) AS total
        FROM sales AS s
        WHERE ${whereClause}
      `,
      parameters,
    );

    const total = Number(countRows[0]?.total ?? "0");

    const [rows] = await connection.execute<SaleListRow[]>(
      `
        SELECT
          CAST(s.id AS CHAR) AS id,
          CAST(s.business_id AS CHAR) AS businessId,
          CAST(s.location_id AS CHAR) AS locationId,
          CAST(s.order_id AS CHAR) AS orderId,
          CAST(s.cash_session_id AS CHAR) AS cashSessionId,
          CAST(s.commercial_customer_id AS CHAR)
            AS commercialCustomerId,

          customer.legal_name AS customerName,

          CAST(s.sold_by_membership_id AS CHAR)
            AS soldByMembershipId,
          sold_user.full_name AS soldByName,

          bl.code AS locationCode,
          bl.name AS locationName,
          bl.location_type AS locationType,

          s.status,
          s.currency_code AS currencyCode,

          CAST(
            COALESCE(item_totals.itemCount, 0)
            AS CHAR
          ) AS itemCount,

          CAST(
            COALESCE(item_totals.unitsSold, 0)
            AS CHAR
          ) AS unitsSold,

          CAST(s.net_subtotal AS CHAR) AS netSubtotal,
          CAST(s.tax_total AS CHAR) AS taxTotal,
          CAST(s.discount_total AS CHAR) AS discountTotal,
          CAST(s.tip_total AS CHAR) AS tipTotal,
          CAST(s.total AS CHAR) AS total,
          CAST(s.paid_total AS CHAR) AS paidTotal,
          CAST(s.change_total AS CHAR) AS changeTotal,

          CAST(
            COALESCE(refund_totals.refundCount, 0)
            AS CHAR
          ) AS refundCount,

          CAST(
            COALESCE(refund_totals.refundedNetAmount, 0)
            AS CHAR
          ) AS refundedNetAmount,

          CAST(
            COALESCE(refund_totals.refundedTaxAmount, 0)
            AS CHAR
          ) AS refundedTaxAmount,

          CAST(
            COALESCE(refund_totals.refundedTotalAmount, 0)
            AS CHAR
          ) AS refundedTotalAmount,

          CAST(
            CASE
              WHEN s.status = 'VOIDED'
                THEN s.total
              ELSE 0
            END
            AS CHAR
          ) AS voidedAmount,

          CAST(
            CASE
              WHEN s.status = 'VOIDED'
                THEN 0
              ELSE
                s.net_subtotal
                - COALESCE(
                    refund_totals.refundedNetAmount,
                    0
                  )
            END
            AS CHAR
          ) AS effectiveNetAmount,

          CAST(
            CASE
              WHEN s.status = 'VOIDED'
                THEN 0
              ELSE
                s.tax_total
                - COALESCE(
                    refund_totals.refundedTaxAmount,
                    0
                  )
            END
            AS CHAR
          ) AS effectiveTaxAmount,

          CAST(
            CASE
              WHEN s.status = 'VOIDED'
                THEN 0
              ELSE
                s.total
                - COALESCE(
                    refund_totals.refundedTotalAmount,
                    0
                  )
            END
            AS CHAR
          ) AS effectiveTotalAmount,

          CAST(s.voided_by_membership_id AS CHAR)
            AS voidedByMembershipId,
          voided_user.full_name AS voidedByName,
          s.void_reason AS voidReason,
          s.voided_at AS voidedAt,

          s.sold_at AS soldAt,
          s.created_at AS createdAt,
          s.updated_at AS updatedAt
        FROM sales AS s

        INNER JOIN business_locations AS bl
          ON bl.business_id = s.business_id
          AND bl.id = s.location_id

        INNER JOIN business_memberships AS sold_membership
          ON sold_membership.business_id = s.business_id
          AND sold_membership.id = s.sold_by_membership_id

        INNER JOIN users AS sold_user
          ON sold_user.id = sold_membership.user_id

        LEFT JOIN commercial_customers AS customer
          ON customer.business_id = s.business_id
          AND customer.id = s.commercial_customer_id

        LEFT JOIN business_memberships AS voided_membership
          ON voided_membership.business_id = s.business_id
          AND voided_membership.id = s.voided_by_membership_id

        LEFT JOIN users AS voided_user
          ON voided_user.id = voided_membership.user_id

        LEFT JOIN (
          SELECT
            business_id,
            sale_id,
            COUNT(*) AS itemCount,
            SUM(quantity) AS unitsSold
          FROM sale_items
          GROUP BY
            business_id,
            sale_id
        ) AS item_totals
          ON item_totals.business_id = s.business_id
          AND item_totals.sale_id = s.id

        LEFT JOIN (
          SELECT
            business_id,
            sale_id,
            COUNT(*) AS refundCount,
            SUM(net_amount) AS refundedNetAmount,
            SUM(tax_amount) AS refundedTaxAmount,
            SUM(total_amount) AS refundedTotalAmount
          FROM sale_refunds
          GROUP BY
            business_id,
            sale_id
        ) AS refund_totals
          ON refund_totals.business_id = s.business_id
          AND refund_totals.sale_id = s.id

        WHERE ${whereClause}

        ORDER BY
          s.sold_at DESC,
          s.id DESC

        LIMIT ?
        OFFSET ?
      `,
      [...parameters, filters.pageSize, offset],
    );

    await connection.commit();

    return {
      sales: rows.map(mapSaleListRow),

      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { findSales };
