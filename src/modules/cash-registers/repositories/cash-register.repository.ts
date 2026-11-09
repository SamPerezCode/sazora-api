import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { LocationType } from "../../locations/location.types";
import type {
  CashRegister,
  CashRegisterFilters,
  CreateCashRegisterData,
} from "../cash-register.types";

type CashRegisterRow = RowDataPacket & {
  id: string;
  businessId: string;
  locationId: string;
  code: string;
  name: string;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  locationIsSalesLocation: number;
  locationIsActive: number;
};

const mapCashRegisterRow = (row: CashRegisterRow): CashRegister => ({
  id: row.id,
  businessId: row.businessId,
  locationId: row.locationId,
  code: row.code,
  name: row.name,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  location: {
    id: row.locationId,
    code: row.locationCode,
    name: row.locationName,
    locationType: row.locationType,
    isSalesLocation: Boolean(row.locationIsSalesLocation),
    isActive: Boolean(row.locationIsActive),
  },
});

const cashRegisterSelect = `
  SELECT
    CAST(cr.id AS CHAR) AS id,
    CAST(cr.business_id AS CHAR) AS businessId,
    CAST(cr.location_id AS CHAR) AS locationId,
    cr.code,
    cr.name,
    cr.is_active AS isActive,
    cr.created_at AS createdAt,
    cr.updated_at AS updatedAt,
    bl.code AS locationCode,
    bl.name AS locationName,
    bl.location_type AS locationType,
    bl.is_sales_location AS locationIsSalesLocation,
    bl.is_active AS locationIsActive
  FROM cash_registers AS cr
  INNER JOIN business_locations AS bl
    ON bl.business_id = cr.business_id
    AND bl.id = cr.location_id
`;

const findCashRegisterById = async (
  businessId: string,
  cashRegisterId: string,
): Promise<CashRegister | null> => {
  const [rows] = await databasePool.execute<CashRegisterRow[]>(
    `
      ${cashRegisterSelect}
      WHERE
        cr.business_id = ?
        AND cr.id = ?
      LIMIT 1
    `,
    [businessId, cashRegisterId],
  );

  return rows[0] ? mapCashRegisterRow(rows[0]) : null;
};

const findCashRegisterByLocationAndCode = async (
  businessId: string,
  locationId: string,
  code: string,
): Promise<CashRegister | null> => {
  const [rows] = await databasePool.execute<CashRegisterRow[]>(
    `
      ${cashRegisterSelect}
      WHERE
        cr.business_id = ?
        AND cr.location_id = ?
        AND cr.code = ?
      LIMIT 1
    `,
    [businessId, locationId, code],
  );

  return rows[0] ? mapCashRegisterRow(rows[0]) : null;
};

const findCashRegisters = async (
  businessId: string,
  filters: CashRegisterFilters,
): Promise<CashRegister[]> => {
  const conditions = ["cr.business_id = ?"];
  const parameters: (string | boolean)[] = [businessId];

  if (filters.locationId !== undefined) {
    conditions.push("cr.location_id = ?");
    parameters.push(filters.locationId);
  }

  if (filters.activeOnly) {
    conditions.push("cr.is_active = TRUE");
    conditions.push("bl.is_active = TRUE");
    conditions.push("bl.is_sales_location = TRUE");
  }

  const [rows] = await databasePool.execute<CashRegisterRow[]>(
    `
      ${cashRegisterSelect}
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        bl.name ASC,
        cr.name ASC,
        cr.id ASC
    `,
    parameters,
  );

  return rows.map(mapCashRegisterRow);
};

const insertCashRegister = async (
  businessId: string,
  data: CreateCashRegisterData,
): Promise<CashRegister> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO cash_registers (
        business_id,
        location_id,
        code,
        name
      )
      VALUES (?, ?, ?, ?)
    `,
    [businessId, data.locationId, data.code, data.name],
  );

  const cashRegister = await findCashRegisterById(
    businessId,
    result.insertId.toString(),
  );

  if (!cashRegister) {
    throw new Error("No fue posible recuperar la caja creada");
  }

  return cashRegister;
};

export {
  findCashRegisterById,
  findCashRegisterByLocationAndCode,
  findCashRegisters,
  insertCashRegister,
};
