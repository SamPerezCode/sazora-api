import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderServiceType } from "../../orders/order.types";
import type {
  SalesBusinessContext,
  SalesByServiceType,
  SalesHistoryItem,
  SalesHistoryResult,
  SalesReportFilters,
  SalesSummaryRecord,
  SalesTopProduct,
} from "../sales-report.types";

type SalesBusinessContextRow = RowDataPacket & {
  id: string;
  name: string;
  timezone: string;
  currencyCode: string;
};

type SalesSummaryRow = RowDataPacket & {
  salesTotal: string;
  orderCount: string;
  unitsSold: string;
  averageTicket: string;
};

type SalesByServiceTypeRow = RowDataPacket & {
  serviceType: OrderServiceType;
  salesTotal: string;
  orderCount: string;
  unitsSold: string;
};

type SalesHistoryRow = RowDataPacket & {
  orderId: string;
  serviceType: OrderServiceType;
  restaurantTableId: string | null;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  openedByMembershipId: string;
  openedByName: string;
  customerCount: number | null;
  itemCount: string;
  unitsSold: string;
  salesTotal: string;
  createdAt: Date;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date;
};

type SalesTopProductRow = RowDataPacket & {
  productId: string;
  productName: string;
  quantitySold: string;
  orderCount: string;
  salesTotal: string;
};

type CountRow = RowDataPacket & {
  total: string;
};

type SalesWhereClause = Readonly<{
  sql: string;
  values: readonly string[];
}>;

const createSalesWhereClause = (
  businessId: string,
  filters: SalesReportFilters,
): SalesWhereClause => {
  const conditions = [
    "o.business_id = ?",
    "o.status = 'CLOSED'",
    "o.closed_at >= ?",
    "o.closed_at < ?",
  ];

  const values = [businessId, filters.period.start, filters.period.end];

  if (filters.serviceType !== undefined) {
    conditions.push("o.service_type = ?");
    values.push(filters.serviceType);
  }

  if (filters.openedByMembershipId !== undefined) {
    conditions.push("o.opened_by_membership_id = ?");
    values.push(filters.openedByMembershipId);
  }

  return {
    sql: conditions.join("\n          AND "),
    values,
  };
};

const findSalesBusinessContext = async (
  businessId: string,
): Promise<SalesBusinessContext | null> => {
  const [rows] = await databasePool.execute<SalesBusinessContextRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        name,
        timezone,
        currency_code AS currencyCode
      FROM businesses
      WHERE
        id = ?
        AND is_active = TRUE
      LIMIT 1
    `,
    [businessId],
  );

  const business = rows[0];

  if (!business) {
    return null;
  }

  return {
    id: business.id,
    name: business.name,
    timezone: business.timezone,
    currencyCode: business.currencyCode,
  };
};

const findSalesSummary = async (
  businessId: string,
  filters: SalesReportFilters,
): Promise<SalesSummaryRecord> => {
  const where = createSalesWhereClause(businessId, filters);

  const [rows] = await databasePool.execute<SalesSummaryRow[]>(
    `
      SELECT
        CAST(
          COALESCE(SUM(order_totals.salesTotal), 0.00)
          AS CHAR
        ) AS salesTotal,

        CAST(COUNT(*) AS CHAR) AS orderCount,

        CAST(
          COALESCE(SUM(order_totals.unitsSold), 0)
          AS CHAR
        ) AS unitsSold,

        CAST(
          COALESCE(AVG(order_totals.salesTotal), 0.00)
          AS CHAR
        ) AS averageTicket

      FROM (
        SELECT
          o.id,
          SUM(oi.quantity * oi.unit_price) AS salesTotal,
          SUM(oi.quantity) AS unitsSold

        FROM orders AS o

        INNER JOIN order_items AS oi
          ON oi.business_id = o.business_id
          AND oi.order_id = o.id
          AND oi.status = 'ACTIVE'

        WHERE
          ${where.sql}

        GROUP BY o.id
      ) AS order_totals
    `,
    [...where.values],
  );

  const summary = rows[0];

  return {
    salesTotal: summary?.salesTotal ?? "0.00",
    orderCount: Number(summary?.orderCount ?? 0),
    unitsSold: Number(summary?.unitsSold ?? 0),
    averageTicket: summary?.averageTicket ?? "0.00",
  };
};

const findSalesByServiceType = async (
  businessId: string,
  filters: SalesReportFilters,
): Promise<SalesByServiceType[]> => {
  const where = createSalesWhereClause(businessId, filters);

  const [rows] = await databasePool.execute<SalesByServiceTypeRow[]>(
    `
      SELECT
        o.service_type AS serviceType,

        CAST(
          COALESCE(SUM(oi.quantity * oi.unit_price), 0.00)
          AS CHAR
        ) AS salesTotal,

        CAST(
          COUNT(DISTINCT o.id)
          AS CHAR
        ) AS orderCount,

        CAST(
          COALESCE(SUM(oi.quantity), 0)
          AS CHAR
        ) AS unitsSold

      FROM orders AS o

      INNER JOIN order_items AS oi
        ON oi.business_id = o.business_id
        AND oi.order_id = o.id
        AND oi.status = 'ACTIVE'

      WHERE
        ${where.sql}

      GROUP BY o.service_type
      ORDER BY o.service_type ASC
    `,
    [...where.values],
  );

  return rows.map((row) => ({
    serviceType: row.serviceType,
    salesTotal: row.salesTotal,
    orderCount: Number(row.orderCount),
    unitsSold: Number(row.unitsSold),
  }));
};

const findSalesHistory = async (
  businessId: string,
  filters: SalesReportFilters,
): Promise<SalesHistoryResult> => {
  const where = createSalesWhereClause(businessId, filters);

  const [countRows] = await databasePool.execute<CountRow[]>(
    `
      SELECT CAST(COUNT(*) AS CHAR) AS total
      FROM orders AS o
      WHERE
        ${where.sql}
    `,
    [...where.values],
  );

  const total = Number(countRows[0]?.total ?? 0);
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows] = await databasePool.execute<SalesHistoryRow[]>(
    `
      SELECT
        CAST(o.id AS CHAR) AS orderId,
        o.service_type AS serviceType,

        CAST(o.restaurant_table_id AS CHAR)
          AS restaurantTableId,

        rt.code AS restaurantTableCode,
        rt.name AS restaurantTableName,

        CAST(o.opened_by_membership_id AS CHAR)
          AS openedByMembershipId,

        u.full_name AS openedByName,
        o.customer_count AS customerCount,

        CAST(
          COUNT(oi.id)
          AS CHAR
        ) AS itemCount,

        CAST(
          COALESCE(SUM(oi.quantity), 0)
          AS CHAR
        ) AS unitsSold,

        CAST(
          COALESCE(
            SUM(oi.quantity * oi.unit_price),
            0.00
          )
          AS CHAR
        ) AS salesTotal,

        o.created_at AS createdAt,
        o.confirmed_at AS confirmedAt,
        o.delivered_at AS deliveredAt,
        o.closed_at AS closedAt

      FROM orders AS o

      INNER JOIN business_memberships AS bm
        ON bm.business_id = o.business_id
        AND bm.id = o.opened_by_membership_id

      INNER JOIN users AS u
        ON u.id = bm.user_id

      LEFT JOIN restaurant_tables AS rt
        ON rt.business_id = o.business_id
        AND rt.id = o.restaurant_table_id

      LEFT JOIN order_items AS oi
        ON oi.business_id = o.business_id
        AND oi.order_id = o.id
        AND oi.status = 'ACTIVE'

      WHERE
        ${where.sql}

      GROUP BY
        o.id,
        o.service_type,
        o.restaurant_table_id,
        rt.code,
        rt.name,
        o.opened_by_membership_id,
        u.full_name,
        o.customer_count,
        o.created_at,
        o.confirmed_at,
        o.delivered_at,
        o.closed_at

      ORDER BY
        o.closed_at DESC,
        o.id DESC

      LIMIT ?
      OFFSET ?
    `,
    [...where.values, filters.pageSize, offset],
  );

  const sales: SalesHistoryItem[] = rows.map((row) => ({
    orderId: row.orderId,
    serviceType: row.serviceType,
    restaurantTableId: row.restaurantTableId,
    restaurantTableCode: row.restaurantTableCode,
    restaurantTableName: row.restaurantTableName,
    openedByMembershipId: row.openedByMembershipId,
    openedByName: row.openedByName,
    customerCount: row.customerCount,
    itemCount: Number(row.itemCount),
    unitsSold: Number(row.unitsSold),
    salesTotal: row.salesTotal,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
    deliveredAt: row.deliveredAt,
    closedAt: row.closedAt,
  }));

  return {
    sales,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

const findSalesTopProducts = async (
  businessId: string,
  filters: SalesReportFilters,
): Promise<SalesTopProduct[]> => {
  const where = createSalesWhereClause(businessId, filters);

  const [rows] = await databasePool.execute<SalesTopProductRow[]>(
    `
      SELECT
        CAST(oi.product_id AS CHAR) AS productId,
        p.name AS productName,

        CAST(
          SUM(oi.quantity)
          AS CHAR
        ) AS quantitySold,

        CAST(
          COUNT(DISTINCT oi.order_id)
          AS CHAR
        ) AS orderCount,

        CAST(
          SUM(oi.quantity * oi.unit_price)
          AS CHAR
        ) AS salesTotal

      FROM order_items AS oi

      INNER JOIN orders AS o
        ON o.business_id = oi.business_id
        AND o.id = oi.order_id

      INNER JOIN products AS p
        ON p.business_id = oi.business_id
        AND p.id = oi.product_id

      WHERE
        oi.status = 'ACTIVE'
        AND ${where.sql}

      GROUP BY
        oi.product_id,
        p.name

      ORDER BY
        SUM(oi.quantity) DESC,
        SUM(oi.quantity * oi.unit_price) DESC,
        oi.product_id ASC

      LIMIT ?
    `,
    [...where.values, filters.topLimit],
  );

  return rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    quantitySold: Number(row.quantitySold),
    orderCount: Number(row.orderCount),
    salesTotal: row.salesTotal,
  }));
};

export {
  findSalesBusinessContext,
  findSalesByServiceType,
  findSalesHistory,
  findSalesSummary,
  findSalesTopProducts,
};
