import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { InventoryUnit } from "../../inventory-items/inventory-item.types";
import type { OrderServiceType, OrderStatus } from "../../orders/order.types";
import type {
  DashboardBusinessContext,
  DashboardCriticalInventoryItem,
  DashboardDeliverySummary,
  DashboardOrderInProgress,
  DashboardOrderSummary,
  DashboardPeriod,
  DashboardTopProduct,
  DashboardWeeklySalesTotal,
} from "../dashboard.types";

type DashboardBusinessRow = RowDataPacket & {
  id: string;
  name: string;
  timezone: string;
  currencyCode: string;
};

type DashboardOrderSummaryRow = RowDataPacket & {
  todaySales: string;
  yesterdaySales: string;
  openOrders: string;
  servedCustomers: string;
  closedOrders: string;
  averageTicket: string;
};

type DashboardDeliverySummaryRow = RowDataPacket & {
  activeDeliveries: string;
  averageDeliveryMinutes: string | null;
};

type DashboardWeeklySalesRow = RowDataPacket & {
  dayIndex: number;
  total: string;
};

type DashboardTopProductRow = RowDataPacket & {
  productId: string;
  productName: string;
  quantitySold: string;
  salesTotal: string;
};

type DashboardOrderInProgressRow = RowDataPacket & {
  id: string;
  serviceType: OrderServiceType;
  status: OrderStatus;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  customerName: string | null;
  deliveryAddress: string | null;
  itemCount: string;
  subtotal: string;
  createdAt: Date;
};

type DashboardCriticalInventoryRow = RowDataPacket & {
  inventoryItemId: string;
  name: string;
  baseUnit: InventoryUnit;
  currentStock: string;
  minimumStock: string;
  stockPercentage: string | null;
};

const findDashboardBusinessContext = async (
  businessId: string,
): Promise<DashboardBusinessContext | null> => {
  const [rows] = await databasePool.execute<DashboardBusinessRow[]>(
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

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    currencyCode: row.currencyCode,
  };
};

const findDashboardOrderSummary = async (
  businessId: string,
  period: DashboardPeriod,
): Promise<DashboardOrderSummary> => {
  const [rows] = await databasePool.execute<DashboardOrderSummaryRow[]>(
    `
      SELECT
        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN
                  o.status = 'CLOSED'
                  AND o.closed_at >= ?
                  AND o.closed_at < ?
                THEN COALESCE(item_totals.subtotal, 0.00)
                ELSE 0.00
              END
            ),
            0.00
          )
          AS CHAR
        ) AS todaySales,

        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN
                  o.status = 'CLOSED'
                  AND o.closed_at >= ?
                  AND o.closed_at < ?
                THEN COALESCE(item_totals.subtotal, 0.00)
                ELSE 0.00
              END
            ),
            0.00
          )
          AS CHAR
        ) AS yesterdaySales,

        CAST(
          COUNT(
            CASE
              WHEN o.status IN ('OPEN', 'CONFIRMED', 'DELIVERED')
              THEN 1
            END
          )
          AS CHAR
        ) AS openOrders,

        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN
                  o.status = 'CLOSED'
                  AND o.closed_at >= ?
                  AND o.closed_at < ?
                THEN COALESCE(o.customer_count, 0)
                ELSE 0
              END
            ),
            0
          )
          AS CHAR
        ) AS servedCustomers,

        CAST(
          COUNT(
            CASE
              WHEN
                o.status = 'CLOSED'
                AND o.closed_at >= ?
                AND o.closed_at < ?
              THEN 1
            END
          )
          AS CHAR
        ) AS closedOrders,

        CAST(
          COALESCE(
            AVG(
              CASE
                WHEN
                  o.status = 'CLOSED'
                  AND o.closed_at >= ?
                  AND o.closed_at < ?
                THEN COALESCE(item_totals.subtotal, 0.00)
              END
            ),
            0.00
          )
          AS CHAR
        ) AS averageTicket

      FROM orders AS o

      LEFT JOIN (
        SELECT
          business_id,
          order_id,
          SUM(quantity * unit_price) AS subtotal
        FROM order_items
        WHERE status = 'ACTIVE'
        GROUP BY
          business_id,
          order_id
      ) AS item_totals
        ON item_totals.business_id = o.business_id
        AND item_totals.order_id = o.id

      WHERE o.business_id = ?
    `,
    [
      period.todayStart,
      period.tomorrowStart,
      period.yesterdayStart,
      period.todayStart,
      period.todayStart,
      period.tomorrowStart,
      period.todayStart,
      period.tomorrowStart,
      period.todayStart,
      period.tomorrowStart,
      businessId,
    ],
  );

  const row = rows[0];

  return {
    todaySales: row?.todaySales ?? "0.00",
    yesterdaySales: row?.yesterdaySales ?? "0.00",
    openOrders: Number(row?.openOrders ?? 0),
    servedCustomers: Number(row?.servedCustomers ?? 0),
    closedOrders: Number(row?.closedOrders ?? 0),
    averageTicket: row?.averageTicket ?? "0.00",
  };
};

const findDashboardDeliverySummary = async (
  businessId: string,
  period: DashboardPeriod,
): Promise<DashboardDeliverySummary> => {
  const [rows] = await databasePool.execute<DashboardDeliverySummaryRow[]>(
    `
      SELECT
        CAST(
          COUNT(
            CASE
              WHEN status IN (
                'PENDING_ASSIGNMENT',
                'ASSIGNED',
                'PICKED_UP',
                'OUT_FOR_DELIVERY'
              )
              THEN 1
            END
          )
          AS CHAR
        ) AS activeDeliveries,

        CAST(
          ROUND(
            AVG(
              CASE
                WHEN
                  status = 'DELIVERED'
                  AND delivered_at >= ?
                  AND delivered_at < ?
                THEN TIMESTAMPDIFF(
                  MINUTE,
                  COALESCE(
                    out_for_delivery_at,
                    picked_up_at,
                    assigned_at,
                    created_at
                  ),
                  delivered_at
                )
              END
            )
          )
          AS CHAR
        ) AS averageDeliveryMinutes

      FROM public_order_deliveries
      WHERE business_id = ?
    `,
    [period.todayStart, period.tomorrowStart, businessId],
  );

  const row = rows[0];

  return {
    activeDeliveries: Number(row?.activeDeliveries ?? 0),
    averageDeliveryMinutes:
      row?.averageDeliveryMinutes === null ||
      row?.averageDeliveryMinutes === undefined
        ? null
        : Number(row.averageDeliveryMinutes),
  };
};

const findDashboardWeeklySales = async (
  businessId: string,
  period: DashboardPeriod,
): Promise<DashboardWeeklySalesTotal[]> => {
  const caseConditions = period.days
    .map(
      (_, dayIndex) => `
        WHEN
          o.closed_at >= ?
          AND o.closed_at < ?
        THEN ${dayIndex}
      `,
    )
    .join("\n");

  const dayBoundaryValues = period.days.flatMap((day) => [day.start, day.end]);

  const firstDay = period.days[0];
  const lastDay = period.days.at(-1);

  if (!firstDay || !lastDay) {
    return [];
  }

  const [rows] = await databasePool.execute<DashboardWeeklySalesRow[]>(
    `
      SELECT
        CASE
          ${caseConditions}
        END AS dayIndex,

        CAST(
          COALESCE(
            SUM(COALESCE(item_totals.subtotal, 0.00)),
            0.00
          )
          AS CHAR
        ) AS total

      FROM orders AS o

      LEFT JOIN (
        SELECT
          business_id,
          order_id,
          SUM(quantity * unit_price) AS subtotal
        FROM order_items
        WHERE status = 'ACTIVE'
        GROUP BY
          business_id,
          order_id
      ) AS item_totals
        ON item_totals.business_id = o.business_id
        AND item_totals.order_id = o.id

      WHERE
        o.business_id = ?
        AND o.status = 'CLOSED'
        AND o.closed_at >= ?
        AND o.closed_at < ?

      GROUP BY dayIndex
      HAVING dayIndex IS NOT NULL
      ORDER BY dayIndex ASC
    `,
    [...dayBoundaryValues, businessId, firstDay.start, lastDay.end],
  );

  return rows.map((row) => ({
    dayIndex: Number(row.dayIndex),
    total: row.total,
  }));
};

const findDashboardTopProducts = async (
  businessId: string,
  period: DashboardPeriod,
): Promise<DashboardTopProduct[]> => {
  const firstDay = period.days[0];
  const lastDay = period.days.at(-1);

  if (!firstDay || !lastDay) {
    return [];
  }

  const [rows] = await databasePool.execute<DashboardTopProductRow[]>(
    `
      SELECT
        CAST(oi.product_id AS CHAR) AS productId,
        p.name AS productName,
        CAST(SUM(oi.quantity) AS CHAR) AS quantitySold,
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
        oi.business_id = ?
        AND oi.status = 'ACTIVE'
        AND o.status = 'CLOSED'
        AND o.closed_at >= ?
        AND o.closed_at < ?

      GROUP BY
        oi.product_id,
        p.name

      ORDER BY
        SUM(oi.quantity) DESC,
        SUM(oi.quantity * oi.unit_price) DESC,
        oi.product_id ASC

      LIMIT 5
    `,
    [businessId, firstDay.start, lastDay.end],
  );

  return rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    quantitySold: Number(row.quantitySold),
    salesTotal: row.salesTotal,
  }));
};

const findDashboardOrdersInProgress = async (
  businessId: string,
): Promise<DashboardOrderInProgress[]> => {
  const [rows] = await databasePool.execute<DashboardOrderInProgressRow[]>(
    `
      SELECT
        CAST(o.id AS CHAR) AS id,
        o.service_type AS serviceType,
        o.status,
        rt.code AS restaurantTableCode,
        rt.name AS restaurantTableName,

        (
          SELECT por.customer_name
          FROM public_order_requests AS por
          WHERE
            por.business_id = o.business_id
            AND por.order_id = o.id
          ORDER BY por.id DESC
          LIMIT 1
        ) AS customerName,

        (
          SELECT por.delivery_address
          FROM public_order_requests AS por
          WHERE
            por.business_id = o.business_id
            AND por.order_id = o.id
          ORDER BY por.id DESC
          LIMIT 1
        ) AS deliveryAddress,

        CAST(
          COALESCE(item_totals.item_count, 0)
          AS CHAR
        ) AS itemCount,

        CAST(
          COALESCE(item_totals.subtotal, 0.00)
          AS CHAR
        ) AS subtotal,

        o.created_at AS createdAt

      FROM orders AS o

      LEFT JOIN restaurant_tables AS rt
        ON rt.business_id = o.business_id
        AND rt.id = o.restaurant_table_id

      LEFT JOIN (
        SELECT
          business_id,
          order_id,
          SUM(quantity) AS item_count,
          SUM(quantity * unit_price) AS subtotal
        FROM order_items
        WHERE status = 'ACTIVE'
        GROUP BY
          business_id,
          order_id
      ) AS item_totals
        ON item_totals.business_id = o.business_id
        AND item_totals.order_id = o.id

      WHERE
        o.business_id = ?
        AND o.status IN ('OPEN', 'CONFIRMED', 'DELIVERED')

      ORDER BY
        FIELD(
          o.status,
          'CONFIRMED',
          'OPEN',
          'DELIVERED'
        ),
        o.created_at ASC,
        o.id ASC

      LIMIT 6
    `,
    [businessId],
  );

  return rows.map((row) => ({
    id: row.id,
    serviceType: row.serviceType,
    status: row.status,
    restaurantTableCode: row.restaurantTableCode,
    restaurantTableName: row.restaurantTableName,
    customerName: row.customerName,
    deliveryAddress: row.deliveryAddress,
    itemCount: Number(row.itemCount),
    subtotal: row.subtotal,
    createdAt: row.createdAt,
  }));
};

const findDashboardCriticalInventory = async (
  businessId: string,
): Promise<DashboardCriticalInventoryItem[]> => {
  const [rows] = await databasePool.execute<DashboardCriticalInventoryRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS inventoryItemId,
        name,
        base_unit AS baseUnit,
        CAST(current_stock AS CHAR) AS currentStock,
        CAST(minimum_stock AS CHAR) AS minimumStock,

        CASE
          WHEN minimum_stock <= 0
          THEN NULL
          ELSE CAST(
            ROUND(
              (current_stock / minimum_stock) * 100,
              2
            )
            AS CHAR
          )
        END AS stockPercentage

      FROM inventory_items

      WHERE
        business_id = ?
        AND is_active = TRUE
        AND current_stock <= minimum_stock

      ORDER BY
        CASE
          WHEN current_stock <= 0 THEN 0
          ELSE 1
        END,
        (
          CASE
            WHEN minimum_stock <= 0 THEN 0
            ELSE current_stock / minimum_stock
          END
        ) ASC,
        name ASC,
        id ASC

      LIMIT 6
    `,
    [businessId],
  );

  return rows.map((row) => ({
    inventoryItemId: row.inventoryItemId,
    name: row.name,
    baseUnit: row.baseUnit,
    currentStock: row.currentStock,
    minimumStock: row.minimumStock,
    stockPercentage:
      row.stockPercentage === null ? null : Number(row.stockPercentage),
  }));
};

export {
  findDashboardBusinessContext,
  findDashboardCriticalInventory,
  findDashboardDeliverySummary,
  findDashboardOrdersInProgress,
  findDashboardOrderSummary,
  findDashboardTopProducts,
  findDashboardWeeklySales,
};
