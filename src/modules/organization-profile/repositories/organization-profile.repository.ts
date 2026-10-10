import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  OrganizationFiscalProfile,
  SaveOrganizationFiscalProfileData,
  TaxResponsibility,
} from "../organization-profile.types";

type ProfileRow = RowDataPacket & {
  businessId: string;
  legalName: string;
  commercialName: string | null;
  personType: OrganizationFiscalProfile["personType"];
  documentType: OrganizationFiscalProfile["documentType"];
  documentNumber: string;
  verificationDigit: string | null;
  taxRegimeCode: string | null;
  vatResponsibilityCode: string | null;
  consumptionTaxApplicable: number;
  economicActivityCode: string | null;
  fiscalAddress: string;
  countryCode: string;
  departmentCode: string | null;
  departmentName: string;
  municipalityCode: string | null;
  municipalityName: string;
  postalCode: string | null;
  billingEmail: string;
  billingPhone: string | null;
  administrativeContactName: string | null;
  administrativeContactEmail: string | null;
  administrativeContactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ResponsibilityRow = RowDataPacket & TaxResponsibility;

const findOrganizationFiscalProfile = async (
  businessId: string,
): Promise<OrganizationFiscalProfile | null> => {
  const [profileRows] = await databasePool.execute<ProfileRow[]>(
    `
      SELECT
        CAST(business_id AS CHAR) AS businessId,
        legal_name AS legalName,
        commercial_name AS commercialName,
        person_type AS personType,
        document_type AS documentType,
        document_number AS documentNumber,
        verification_digit AS verificationDigit,
        tax_regime_code AS taxRegimeCode,
        vat_responsibility_code AS vatResponsibilityCode,
        consumption_tax_applicable AS consumptionTaxApplicable,
        economic_activity_code AS economicActivityCode,
        fiscal_address AS fiscalAddress,
        country_code AS countryCode,
        department_code AS departmentCode,
        department_name AS departmentName,
        municipality_code AS municipalityCode,
        municipality_name AS municipalityName,
        postal_code AS postalCode,
        billing_email AS billingEmail,
        billing_phone AS billingPhone,
        administrative_contact_name AS administrativeContactName,
        administrative_contact_email AS administrativeContactEmail,
        administrative_contact_phone AS administrativeContactPhone,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM organization_fiscal_profiles
      WHERE business_id = ?
      LIMIT 1
    `,
    [businessId],
  );

  const profile = profileRows[0];

  if (!profile) {
    return null;
  }

  const [responsibilityRows] = await databasePool.execute<ResponsibilityRow[]>(
    `
        SELECT code, name
        FROM organization_tax_responsibilities
        WHERE
          business_id = ?
          AND is_active = TRUE
        ORDER BY code ASC
      `,
    [businessId],
  );

  return {
    ...profile,
    consumptionTaxApplicable: Boolean(profile.consumptionTaxApplicable),
    taxResponsibilities: responsibilityRows,
  };
};

const saveOrganizationFiscalProfile = async (
  businessId: string,
  data: SaveOrganizationFiscalProfileData,
): Promise<OrganizationFiscalProfile> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO organization_fiscal_profiles (
          business_id,
          legal_name,
          commercial_name,
          person_type,
          document_type,
          document_number,
          verification_digit,
          tax_regime_code,
          vat_responsibility_code,
          consumption_tax_applicable,
          economic_activity_code,
          fiscal_address,
          country_code,
          department_code,
          department_name,
          municipality_code,
          municipality_name,
          postal_code,
          billing_email,
          billing_phone,
          administrative_contact_name,
          administrative_contact_email,
          administrative_contact_phone
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON DUPLICATE KEY UPDATE
          legal_name = VALUES(legal_name),
          commercial_name = VALUES(commercial_name),
          person_type = VALUES(person_type),
          document_type = VALUES(document_type),
          document_number = VALUES(document_number),
          verification_digit = VALUES(verification_digit),
          tax_regime_code = VALUES(tax_regime_code),
          vat_responsibility_code = VALUES(vat_responsibility_code),
          consumption_tax_applicable =
            VALUES(consumption_tax_applicable),
          economic_activity_code = VALUES(economic_activity_code),
          fiscal_address = VALUES(fiscal_address),
          country_code = VALUES(country_code),
          department_code = VALUES(department_code),
          department_name = VALUES(department_name),
          municipality_code = VALUES(municipality_code),
          municipality_name = VALUES(municipality_name),
          postal_code = VALUES(postal_code),
          billing_email = VALUES(billing_email),
          billing_phone = VALUES(billing_phone),
          administrative_contact_name =
            VALUES(administrative_contact_name),
          administrative_contact_email =
            VALUES(administrative_contact_email),
          administrative_contact_phone =
            VALUES(administrative_contact_phone)
      `,
      [
        businessId,
        data.legalName,
        data.commercialName,
        data.personType,
        data.documentType,
        data.documentNumber,
        data.verificationDigit,
        data.taxRegimeCode,
        data.vatResponsibilityCode,
        data.consumptionTaxApplicable,
        data.economicActivityCode,
        data.fiscalAddress,
        data.countryCode,
        data.departmentCode,
        data.departmentName,
        data.municipalityCode,
        data.municipalityName,
        data.postalCode,
        data.billingEmail,
        data.billingPhone,
        data.administrativeContactName,
        data.administrativeContactEmail,
        data.administrativeContactPhone,
      ],
    );

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM organization_tax_responsibilities
        WHERE business_id = ?
      `,
      [businessId],
    );

    for (const responsibility of data.taxResponsibilities) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO organization_tax_responsibilities (
            business_id,
            code,
            name
          )
          VALUES (?, ?, ?)
        `,
        [businessId, responsibility.code, responsibility.name],
      );
    }

    await connection.commit();

    const profile = await findOrganizationFiscalProfile(businessId);

    if (!profile) {
      throw new Error("No fue posible recuperar el perfil fiscal guardado");
    }

    return profile;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { findOrganizationFiscalProfile, saveOrganizationFiscalProfile };
