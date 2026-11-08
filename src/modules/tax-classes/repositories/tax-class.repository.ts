import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreateTaxClassData,
  CreateTaxRateData,
  TaxClass,
  TaxRate,
  TaxType,
  UpdateTaxClassData,
} from "../tax-class.types";

type TaxClassRow = RowDataPacket & {
  id: string;
  businessId: string;
  code: string;
  name: string;
  taxType: TaxType;
  description: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type TaxRateRow = RowDataPacket & {
  id: string;
  businessId: string;
  taxClassId: string;
  rate: string;
  validFrom: string;
  validTo: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

const taxClassSelect = `
  SELECT
    CAST(tc.id AS CHAR) AS id,
    CAST(tc.business_id AS CHAR) AS businessId,
    tc.code,
    tc.name,
    tc.tax_type AS taxType,
    tc.description,
    tc.is_active AS isActive,
    tc.created_at AS createdAt,
    tc.updated_at AS updatedAt
  FROM tax_classes AS tc
`;

const taxRateSelect = `
  SELECT
    CAST(tr.id AS CHAR) AS id,
    CAST(tr.business_id AS CHAR) AS businessId,
    CAST(tr.tax_class_id AS CHAR) AS taxClassId,
    CAST(tr.rate AS CHAR) AS rate,
    DATE_FORMAT(tr.valid_from, '%Y-%m-%d') AS validFrom,
    CASE
      WHEN tr.valid_to IS NULL THEN NULL
      ELSE DATE_FORMAT(tr.valid_to, '%Y-%m-%d')
    END AS validTo,
    tr.is_active AS isActive,
    tr.created_at AS createdAt,
    tr.updated_at AS updatedAt
  FROM tax_rates AS tr
`;

const mapTaxRate = (row: TaxRateRow): TaxRate => {
  return {
    id: row.id,
    businessId: row.businessId,
    taxClassId: row.taxClassId,
    rate: row.rate,
    validFrom: row.validFrom,
    validTo: row.validTo,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const mapTaxClass = (row: TaxClassRow, rates: TaxRate[]): TaxClass => {
  return {
    id: row.id,
    businessId: row.businessId,
    code: row.code,
    name: row.name,
    taxType: row.taxType,
    description: row.description,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rates,
  };
};

const findRatesByBusinessId = async (
  businessId: string,
): Promise<TaxRate[]> => {
  const [rows] = await databasePool.execute<TaxRateRow[]>(
    `
      ${taxRateSelect}
      WHERE tr.business_id = ?
      ORDER BY
        tr.tax_class_id ASC,
        tr.valid_from DESC,
        tr.id DESC
    `,
    [businessId],
  );

  return rows.map(mapTaxRate);
};

const findRatesByTaxClassId = async (
  businessId: string,
  taxClassId: string,
): Promise<TaxRate[]> => {
  const [rows] = await databasePool.execute<TaxRateRow[]>(
    `
      ${taxRateSelect}
      WHERE
        tr.business_id = ?
        AND tr.tax_class_id = ?
      ORDER BY
        tr.valid_from DESC,
        tr.id DESC
    `,
    [businessId, taxClassId],
  );

  return rows.map(mapTaxRate);
};

export const findTaxClassesByBusinessId = async (
  businessId: string,
): Promise<TaxClass[]> => {
  const [rows] = await databasePool.execute<TaxClassRow[]>(
    `
      ${taxClassSelect}
      WHERE tc.business_id = ?
      ORDER BY tc.name ASC, tc.id ASC
    `,
    [businessId],
  );

  const rates = await findRatesByBusinessId(businessId);
  const ratesByTaxClassId = new Map<string, TaxRate[]>();

  for (const rate of rates) {
    const classRates = ratesByTaxClassId.get(rate.taxClassId) ?? [];

    classRates.push(rate);
    ratesByTaxClassId.set(rate.taxClassId, classRates);
  }

  return rows.map((row) =>
    mapTaxClass(row, ratesByTaxClassId.get(row.id) ?? []),
  );
};

export const findTaxClassById = async (
  businessId: string,
  taxClassId: string,
): Promise<TaxClass | null> => {
  const [rows] = await databasePool.execute<TaxClassRow[]>(
    `
      ${taxClassSelect}
      WHERE
        tc.business_id = ?
        AND tc.id = ?
      LIMIT 1
    `,
    [businessId, taxClassId],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  const rates = await findRatesByTaxClassId(businessId, taxClassId);

  return mapTaxClass(row, rates);
};

export const createTaxClass = async (
  businessId: string,
  data: CreateTaxClassData,
): Promise<TaxClass> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [taxClassResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO tax_classes (
            business_id,
            code,
            name,
            tax_type,
            description,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, TRUE)
        `,
      [businessId, data.code, data.name, data.taxType, data.description],
    );

    const taxClassId = String(taxClassResult.insertId);

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO tax_rates (
          business_id,
          tax_class_id,
          rate,
          valid_from,
          valid_to,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, TRUE)
      `,
      [
        businessId,
        taxClassId,
        data.initialRate.rate,
        data.initialRate.validFrom,
        data.initialRate.validTo,
      ],
    );

    await connection.commit();

    const taxClass = await findTaxClassById(businessId, taxClassId);

    if (!taxClass) {
      throw new Error("La clase de impuesto creada no pudo recuperarse");
    }

    return taxClass;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateTaxClass = async (
  businessId: string,
  taxClassId: string,
  data: UpdateTaxClassData,
): Promise<TaxClass | null> => {
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (data.code !== undefined) {
    fields.push("code = ?");
    values.push(data.code);
  }

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }

  if (data.description !== undefined) {
    fields.push("description = ?");
    values.push(data.description);
  }

  if (fields.length === 0) {
    return findTaxClassById(businessId, taxClassId);
  }

  values.push(businessId, taxClassId);

  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE tax_classes
      SET ${fields.join(", ")}
      WHERE
        business_id = ?
        AND id = ?
    `,
    values,
  );

  return findTaxClassById(businessId, taxClassId);
};

export const updateTaxClassStatus = async (
  businessId: string,
  taxClassId: string,
  isActive: boolean,
): Promise<TaxClass | null> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE tax_classes
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, taxClassId],
  );

  return findTaxClassById(businessId, taxClassId);
};

export const hasOverlappingTaxRate = async (
  businessId: string,
  taxClassId: string,
  validFrom: string,
  validTo: string | null,
): Promise<boolean> => {
  const [rows] = await databasePool.execute<RowDataPacket[]>(
    `
      SELECT 1
      FROM tax_rates AS tr
      WHERE
        tr.business_id = ?
        AND tr.tax_class_id = ?
        AND tr.is_active = TRUE
        AND tr.valid_from <= COALESCE(?, '9999-12-31')
        AND COALESCE(tr.valid_to, '9999-12-31') >= ?
      LIMIT 1
    `,
    [businessId, taxClassId, validTo, validFrom],
  );

  return rows.length > 0;
};

export const createTaxRate = async (
  businessId: string,
  taxClassId: string,
  data: CreateTaxRateData,
): Promise<TaxClass | null> => {
  await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO tax_rates (
        business_id,
        tax_class_id,
        rate,
        valid_from,
        valid_to,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, TRUE)
    `,
    [businessId, taxClassId, data.rate, data.validFrom, data.validTo],
  );

  return findTaxClassById(businessId, taxClassId);
};
