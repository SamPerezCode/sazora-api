import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import type { OrderSourceChannel } from "../../orders/order.types";
import type {
  CommercialCustomer,
  UpsertCommercialCustomerIdentityData,
} from "../commercial-customer.types";

type CommercialCustomerRow = RowDataPacket & {
  id: string;
  businessId: string;
  legalName: string;
  billingEmail: string | null;
  billingPhone: string | null;
  normalizedPhone: string;
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
  /*
   * El índice único (business_id, normalized_phone) hace que esta operación
   * sea segura frente a dos solicitudes concurrentes del mismo cliente.
   *
   * acquisition_source_channel solamente se llena si todavía es NULL.
   * last_source_channel sí se actualiza en cada interacción.
   *
   * Un marketingConsent NULL significa que el cliente no respondió ninguna
   * pregunta de autorización y, por tanto, no debemos alterar lo existente.
   */

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

export {
  findCommercialCustomerByNormalizedPhone,
  upsertCommercialCustomerIdentity,
};
