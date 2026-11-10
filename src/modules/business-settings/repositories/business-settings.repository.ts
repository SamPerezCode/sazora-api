import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  BusinessSettings,
  UpdateBusinessSettingsData,
} from "../business-settings.types";

type BusinessSettingsRow = RowDataPacket & {
  businessId: string;
  name: string;
  slug: string;
  timezone: string;
  currencyCode: string;
  tagline: string | null;
  phone: string | null;
  address: string | null;
  openingHoursText: string | null;
  instagram: string | null;
  taxId: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  kitchenTicketFooter: string | null;
  publicMenuDescription: string | null;
  publicMenuEnabled: number;
  publicOrderingEnabled: number;
  createdAt: Date;
  updatedAt: Date;
};

type BusinessExistsRow = RowDataPacket & {
  id: string;
};

type InitializeBusinessSettingsResult = Readonly<{
  settings: BusinessSettings;
  created: boolean;
}>;

const mapBusinessSettingsRow = (
  row: BusinessSettingsRow,
): BusinessSettings => ({
  businessId: row.businessId,
  name: row.name,
  slug: row.slug,
  timezone: row.timezone,
  currencyCode: row.currencyCode,
  tagline: row.tagline,
  phone: row.phone,
  address: row.address,
  openingHoursText: row.openingHoursText,
  instagram: row.instagram,
  taxId: row.taxId,
  logoUrl: row.logoUrl,
  primaryColor: row.primaryColor,
  accentColor: row.accentColor,
  kitchenTicketFooter: row.kitchenTicketFooter,
  publicMenuDescription: row.publicMenuDescription,
  publicMenuEnabled: Boolean(row.publicMenuEnabled),
  publicOrderingEnabled: Boolean(row.publicOrderingEnabled),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findBusinessSettingsByBusinessId = async (
  businessId: string,
): Promise<BusinessSettings | null> => {
  const [rows] = await databasePool.execute<BusinessSettingsRow[]>(
    `
      SELECT
        CAST(b.id AS CHAR) AS businessId,
        b.name,
        b.slug,
        b.timezone,
        b.currency_code AS currencyCode,
        bs.tagline,
        bs.phone,
        bs.address,
        bs.opening_hours_text AS openingHoursText,
        bs.instagram,
        bs.tax_id AS taxId,
        bs.logo_url AS logoUrl,
        bs.primary_color AS primaryColor,
        bs.accent_color AS accentColor,
        bs.kitchen_ticket_footer AS kitchenTicketFooter,
        bs.public_menu_description AS publicMenuDescription,
        bs.public_menu_enabled AS publicMenuEnabled,
        bs.public_ordering_enabled AS publicOrderingEnabled,
        bs.created_at AS createdAt,
        bs.updated_at AS updatedAt
      FROM businesses AS b
      INNER JOIN business_settings AS bs
        ON bs.business_id = b.id
      WHERE b.id = ?
      LIMIT 1
    `,
    [businessId],
  );

  const settings = rows[0];

  return settings ? mapBusinessSettingsRow(settings) : null;
};

const initializeBusinessSettings = async (
  businessId: string,
): Promise<InitializeBusinessSettingsResult | null> => {
  const connection = await databasePool.getConnection();
  let created: boolean | undefined;

  try {
    await connection.beginTransaction();

    const [businessRows] = await connection.execute<BusinessExistsRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
        FROM businesses
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId],
    );

    if (!businessRows[0]) {
      await connection.rollback();
      return null;
    }

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT IGNORE INTO business_settings (
          business_id
        )
        VALUES (?)
      `,
      [businessId],
    );

    created = insertResult.affectedRows === 1;

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (created === undefined) {
    throw new Error(
      "No fue posible determinar el resultado de la inicialización",
    );
  }

  const settings = await findBusinessSettingsByBusinessId(businessId);

  if (!settings) {
    throw new Error(
      "No fue posible recuperar la configuración inicializada del negocio",
    );
  }

  return {
    settings,
    created,
  };
};

const updateBusinessSettings = async (
  businessId: string,
  data: UpdateBusinessSettingsData,
): Promise<BusinessSettings | null> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [businessRows] = await connection.execute<BusinessExistsRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
        FROM businesses
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId],
    );

    if (!businessRows[0]) {
      await connection.rollback();
      return null;
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE businesses
        SET name = ?
        WHERE id = ?
      `,
      [data.name, businessId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE business_settings
        SET
          tagline = ?,
          phone = ?,
          address = ?,
          opening_hours_text = ?,
          instagram = ?,
          tax_id = ?,
          primary_color = ?,
          accent_color = ?,
          kitchen_ticket_footer = ?,
          public_menu_description = ?,
          public_menu_enabled = ?,
          public_ordering_enabled = ?
        WHERE business_id = ?
      `,
      [
        data.tagline,
        data.phone,
        data.address,
        data.openingHoursText,
        data.instagram,
        data.taxId,
        data.primaryColor,
        data.accentColor,
        data.kitchenTicketFooter,
        data.publicMenuDescription,
        data.publicMenuEnabled,
        data.publicOrderingEnabled,
        businessId,
      ],
    );

    await connection.commit();

    return findBusinessSettingsByBusinessId(businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateBusinessLogo = async (
  businessId: string,
  logoUrl: string | null,
): Promise<BusinessSettings | null> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE business_settings
      SET logo_url = ?
      WHERE business_id = ?
    `,
    [logoUrl, businessId],
  );

  return findBusinessSettingsByBusinessId(businessId);
};

export {
  findBusinessSettingsByBusinessId,
  initializeBusinessSettings,
  updateBusinessLogo,
  updateBusinessSettings,
};
