import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderSourceChannel } from "../../orders/order.types";
import type {
  CommercialCustomer,
  CommercialCustomerDetail,
  CommercialCustomerListItem,
  CommercialCustomerListResult,
  ListCommercialCustomersFilters,
  UpsertCommercialCustomerIdentityData,
} from "../commercial-customer.types";

type CommercialCustomerRow = RowDataPacket & {
  id: string;
  businessId: string;
  legalName: string;
  billingEmail: string | null;
  billingPhone: string | null;
  normalizedPhone: string | null;
  acquisitionSourceChannel: OrderSourceChannel | null;
  lastSourceChannel: OrderSourceChannel | null;
  marketingConsent: number;
  marketingConsentAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type CommercialCustomerListRow = CommercialCustomerRow & {
  orderCount: string;
  saleCount: string;
  grossSalesTotal: string;
  refundedTotal: string;
  effectiveSalesTotal: string;
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
};

type CountRow = RowDataPacket & {
  total: string;
};

const mapCommercialCustomerRow = (
  row: CommercialCustomerRow,
): CommercialCustomer => ({
  id: row.id,
  businessId: row.businessId,
  legalName: row.legalName,
  billingEmail: row.billingEmail,
  billingPhone: row.billingPhone,
  normalizedPhone: row.normalizedPhone,
  acquisitionSourceChannel: row.acquisitionSourceChannel,
  lastSourceChannel: row.lastSourceChannel,
  marketingConsent: Boolean(row.marketingConsent),
  marketingConsentAt: row.marketingConsentAt,
  firstSeenAt: row.firstSeenAt,
  lastSeenAt: row.lastSeenAt,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const commercialCustomerIdentitySelect = `
  SELECT
    CAST(cc.id AS CHAR) AS id,
    CAST(cc.business_id AS CHAR) AS businessId,
    cc.legal_name AS legalName,
    cc.billing_email AS billingEmail,
    cc.billing_phone AS billingPhone,
    cc.normalized_phone AS normalizedPhone,
    cc.acquisition_source_channel AS acquisitionSourceChannel,
    cc.last_source_channel AS lastSourceChannel,
    cc.marketing_consent AS marketingConsent,
    cc.marketing_consent_at AS marketingConsentAt,
    cc.first_seen_at AS firstSeenAt,
    cc.last_seen_at AS lastSeenAt,
    cc.is_active AS isActive,
    cc.created_at AS createdAt,
    cc.updated_at AS updatedAt
  FROM commercial_customers AS cc
`;

const findCommercialCustomerByNormalizedPhone = async (
  connection: PoolConnection,
  businessId: string,
  normalizedPhone: string,
): Promise<CommercialCustomer | null> => {
  const [rows] = await connection.execute<CommercialCustomerRow[]>(
    `
      ${commercialCustomerIdentitySelect}
      WHERE
        cc.business_id = ?
        AND cc.normalized_phone = ?
      LIMIT 1
    `,
    [businessId, normalizedPhone],
  );

  const customer = rows[0];

  return customer ? mapCommercialCustomerRow(customer) : null;
};

const upsertCommercialCustomerIdentity = async (
  connection: PoolConnection,
  businessId: string,
  data: UpsertCommercialCustomerIdentityData,
): Promise<CommercialCustomer> => {
  const marketingConsentOnCreate = data.marketingConsent ?? false;

  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO commercial_customers (
        business_id,
        customer_type,
        legal_name,
        commercial_name,
        document_type,
        document_number,
        verification_digit,
        billing_email,
        billing_phone,
        normalized_phone,
        acquisition_source_channel,
        last_source_channel,
        marketing_consent,
        marketing_consent_at,
        first_seen_at,
        last_seen_at,
        requires_electronic_invoice,
        is_active
      )
      VALUES (
        ?,
        'PERSON',
        ?,
        NULL,
        NULL,
        NULL,
        NULL,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        CASE
          WHEN ? = TRUE THEN CURRENT_TIMESTAMP(3)
          ELSE NULL
        END,
        CURRENT_TIMESTAMP(3),
        CURRENT_TIMESTAMP(3),
        FALSE,
        TRUE
      )
      ON DUPLICATE KEY UPDATE
        legal_name = ?,
        billing_email = COALESCE(?, billing_email),
        billing_phone = ?,
        acquisition_source_channel = COALESCE(
          acquisition_source_channel,
          ?
        ),
        last_source_channel = ?,
        last_seen_at = CURRENT_TIMESTAMP(3),
        is_active = TRUE,
        marketing_consent = CASE
          WHEN ? IS NULL THEN marketing_consent
          ELSE ?
        END,
        marketing_consent_at = CASE
          WHEN ? IS NULL THEN marketing_consent_at
          WHEN ? = TRUE THEN COALESCE(
            marketing_consent_at,
            CURRENT_TIMESTAMP(3)
          )
          ELSE NULL
        END
    `,
    [
      businessId,
      data.legalName,
      data.billingEmail,
      data.billingPhone,
      data.normalizedPhone,
      data.sourceChannel,
      data.sourceChannel,
      marketingConsentOnCreate,
      marketingConsentOnCreate,

      data.legalName,
      data.billingEmail,
      data.billingPhone,
      data.sourceChannel,
      data.sourceChannel,
      data.marketingConsent,
      data.marketingConsent,
      data.marketingConsent,
      data.marketingConsent,
    ],
  );

  const customer = await findCommercialCustomerByNormalizedPhone(
    connection,
    businessId,
    data.normalizedPhone,
  );

  if (!customer) {
    throw new Error(
      "No fue posible recuperar el cliente comercial identificado",
    );
  }

  return customer;
};

const findCommercialCustomers = async (
  businessId: string,
  filters: ListCommercialCustomersFilters,
): Promise<CommercialCustomerListResult> => {
  const conditions = ["cc.business_id = ?"];
  const values: (string | number | boolean)[] = [businessId];

  if (filters.search !== undefined) {
    const searchPattern = `%${filters.search}%`;

    conditions.push(`
      (
        cc.legal_name LIKE ?
        OR cc.normalized_phone LIKE ?
        OR cc.billing_phone LIKE ?
        OR cc.billing_email LIKE ?
      )
    `);

    values.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (filters.isActive !== undefined) {
    conditions.push("cc.is_active = ?");
    values.push(filters.isActive);
  }

  const whereClause = conditions.join("\n        AND ");
  const offset = (filters.page - 1) * filters.pageSize;

  const [countRows] = await databasePool.execute<CountRow[]>(
    `
      SELECT CAST(COUNT(*) AS CHAR) AS total
      FROM commercial_customers AS cc
      WHERE ${whereClause}
    `,
    values,
  );

  const total = Number(countRows[0]?.total ?? 0);

  const [rows] = await databasePool.execute<CommercialCustomerListRow[]>(
    `
      SELECT
        CAST(cc.id AS CHAR) AS id,
        CAST(cc.business_id AS CHAR) AS businessId,
        cc.legal_name AS legalName,
        cc.billing_email AS billingEmail,
        cc.billing_phone AS billingPhone,
        cc.normalized_phone AS normalizedPhone,
        cc.acquisition_source_channel AS acquisitionSourceChannel,
        cc.last_source_channel AS lastSourceChannel,
        cc.marketing_consent AS marketingConsent,
        cc.marketing_consent_at AS marketingConsentAt,
        cc.first_seen_at AS firstSeenAt,
        cc.last_seen_at AS lastSeenAt,
        cc.is_active AS isActive,
        cc.created_at AS createdAt,
        cc.updated_at AS updatedAt,

        CAST(
          COALESCE(order_totals.orderCount, 0)
          AS CHAR
        ) AS orderCount,

        CAST(
          COALESCE(sale_totals.saleCount, 0)
          AS CHAR
        ) AS saleCount,

        CAST(
          COALESCE(sale_totals.grossSalesTotal, 0.00)
          AS CHAR
        ) AS grossSalesTotal,

        CAST(
          COALESCE(sale_totals.refundedTotal, 0.00)
          AS CHAR
        ) AS refundedTotal,

        CAST(
          COALESCE(sale_totals.effectiveSalesTotal, 0.00)
          AS CHAR
        ) AS effectiveSalesTotal,

        sale_totals.firstPurchaseAt AS firstPurchaseAt,
        sale_totals.lastPurchaseAt AS lastPurchaseAt

      FROM commercial_customers AS cc

      LEFT JOIN (
        SELECT
          business_id,
          commercial_customer_id,
          COUNT(*) AS orderCount
        FROM orders
        WHERE commercial_customer_id IS NOT NULL
        GROUP BY
          business_id,
          commercial_customer_id
      ) AS order_totals
        ON order_totals.business_id = cc.business_id
        AND order_totals.commercial_customer_id = cc.id

      LEFT JOIN (
        SELECT
          s.business_id,
          s.commercial_customer_id,

          SUM(
            CASE
              WHEN s.status = 'VOIDED' THEN 0
              ELSE 1
            END
          ) AS saleCount,

          SUM(
            CASE
              WHEN s.status = 'VOIDED' THEN 0
              ELSE s.total
            END
          ) AS grossSalesTotal,

          SUM(
            CASE
              WHEN s.status = 'VOIDED' THEN 0
              ELSE COALESCE(refunds.refundedTotal, 0.00)
            END
          ) AS refundedTotal,

          SUM(
            CASE
              WHEN s.status = 'VOIDED' THEN 0
              ELSE
                s.total - COALESCE(
                  refunds.refundedTotal,
                  0.00
                )
            END
          ) AS effectiveSalesTotal,

          MIN(
            CASE
              WHEN s.status = 'VOIDED' THEN NULL
              ELSE s.sold_at
            END
          ) AS firstPurchaseAt,

          MAX(
            CASE
              WHEN s.status = 'VOIDED' THEN NULL
              ELSE s.sold_at
            END
          ) AS lastPurchaseAt

        FROM sales AS s

        LEFT JOIN (
          SELECT
            business_id,
            sale_id,
            SUM(total_amount) AS refundedTotal
          FROM sale_refunds
          GROUP BY
            business_id,
            sale_id
        ) AS refunds
          ON refunds.business_id = s.business_id
          AND refunds.sale_id = s.id

        WHERE s.commercial_customer_id IS NOT NULL

        GROUP BY
          s.business_id,
          s.commercial_customer_id
      ) AS sale_totals
        ON sale_totals.business_id = cc.business_id
        AND sale_totals.commercial_customer_id = cc.id

      WHERE ${whereClause}

      ORDER BY
        cc.last_seen_at DESC,
        cc.id DESC

      LIMIT ?
      OFFSET ?
    `,
    [...values, filters.pageSize, offset],
  );

  return {
    customers: rows.map((row): CommercialCustomerListItem => ({
      ...mapCommercialCustomerRow(row),
      orderCount: Number(row.orderCount),
      saleCount: Number(row.saleCount),
      grossSalesTotal: row.grossSalesTotal,
      refundedTotal: row.refundedTotal,
      effectiveSalesTotal: row.effectiveSalesTotal,
      firstPurchaseAt: row.firstPurchaseAt,
      lastPurchaseAt: row.lastPurchaseAt,
    })),

    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

const findCommercialCustomerById = async (
  businessId: string,
  customerId: string,
): Promise<CommercialCustomerDetail | null> => {
  const [rows] = await databasePool.execute<CommercialCustomerListRow[]>(
    `
      SELECT
        CAST(cc.id AS CHAR) AS id,
        CAST(cc.business_id AS CHAR) AS businessId,
        cc.legal_name AS legalName,
        cc.billing_email AS billingEmail,
        cc.billing_phone AS billingPhone,
        cc.normalized_phone AS normalizedPhone,
        cc.acquisition_source_channel AS acquisitionSourceChannel,
        cc.last_source_channel AS lastSourceChannel,
        cc.marketing_consent AS marketingConsent,
        cc.marketing_consent_at AS marketingConsentAt,
        cc.first_seen_at AS firstSeenAt,
        cc.last_seen_at AS lastSeenAt,
        cc.is_active AS isActive,
        cc.created_at AS createdAt,
        cc.updated_at AS updatedAt,

        CAST(
          COALESCE(order_totals.orderCount, 0)
          AS CHAR
        ) AS orderCount,

        CAST(
          COALESCE(sale_totals.saleCount, 0)
          AS CHAR
        ) AS saleCount,

        CAST(
          COALESCE(sale_totals.grossSalesTotal, 0.00)
          AS CHAR
        ) AS grossSalesTotal,

        CAST(
          COALESCE(sale_totals.refundedTotal, 0.00)
          AS CHAR
        ) AS refundedTotal,

        CAST(
          COALESCE(sale_totals.effectiveSalesTotal, 0.00)
          AS CHAR
        ) AS effectiveSalesTotal,

        sale_totals.firstPurchaseAt AS firstPurchaseAt,
        sale_totals.lastPurchaseAt AS lastPurchaseAt

      FROM commercial_customers AS cc

      LEFT JOIN (
        SELECT
          business_id,
          commercial_customer_id,
          COUNT(*) AS orderCount
        FROM orders
        WHERE commercial_customer_id IS NOT NULL
        GROUP BY
          business_id,
          commercial_customer_id
      ) AS order_totals
        ON order_totals.business_id = cc.business_id
        AND order_totals.commercial_customer_id = cc.id

      LEFT JOIN (
        SELECT
          s.business_id,
          s.commercial_customer_id,

          SUM(
            CASE
              WHEN s.status = 'VOIDED' THEN 0
              ELSE 1
            END
          ) AS saleCount,

          SUM(
            CASE
              WHEN s.status = 'VOIDED' THEN 0
              ELSE s.total
            END
          ) AS grossSalesTotal,

          SUM(
            CASE
              WHEN s.status = 'VOIDED' THEN 0
              ELSE COALESCE(refunds.refundedTotal, 0.00)
            END
          ) AS refundedTotal,

          SUM(
            CASE
              WHEN s.status = 'VOIDED' THEN 0
              ELSE
                s.total - COALESCE(
                  refunds.refundedTotal,
                  0.00
                )
            END
          ) AS effectiveSalesTotal,

          MIN(
            CASE
              WHEN s.status = 'VOIDED' THEN NULL
              ELSE s.sold_at
            END
          ) AS firstPurchaseAt,

          MAX(
            CASE
              WHEN s.status = 'VOIDED' THEN NULL
              ELSE s.sold_at
            END
          ) AS lastPurchaseAt

        FROM sales AS s

        LEFT JOIN (
          SELECT
            business_id,
            sale_id,
            SUM(total_amount) AS refundedTotal
          FROM sale_refunds
          GROUP BY
            business_id,
            sale_id
        ) AS refunds
          ON refunds.business_id = s.business_id
          AND refunds.sale_id = s.id

        WHERE s.commercial_customer_id IS NOT NULL

        GROUP BY
          s.business_id,
          s.commercial_customer_id
      ) AS sale_totals
        ON sale_totals.business_id = cc.business_id
        AND sale_totals.commercial_customer_id = cc.id

      WHERE
        cc.business_id = ?
        AND cc.id = ?

      LIMIT 1
    `,
    [businessId, customerId],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapCommercialCustomerRow(row),
    orderCount: Number(row.orderCount),
    saleCount: Number(row.saleCount),
    grossSalesTotal: row.grossSalesTotal,
    refundedTotal: row.refundedTotal,
    effectiveSalesTotal: row.effectiveSalesTotal,
    firstPurchaseAt: row.firstPurchaseAt,
    lastPurchaseAt: row.lastPurchaseAt,
  };
};

export {
  findCommercialCustomerById,
  findCommercialCustomerByNormalizedPhone,
  findCommercialCustomers,
  upsertCommercialCustomerIdentity,
};
