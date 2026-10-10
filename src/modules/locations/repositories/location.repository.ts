import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  BusinessLocation,
  CreateLocationData,
  LocationCapabilities,
  LocationType,
  UpdateLocationData,
} from "../location.types";

type LocationRow = RowDataPacket & {
  id: string;
  businessId: string;
  code: string;
  name: string;
  locationType: LocationType;
  address: string | null;
  countryCode: string;
  departmentCode: string | null;
  departmentName: string | null;
  municipalityCode: string | null;
  municipalityName: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  isInventoryLocation: number;
  isProductionLocation: number;
  isSalesLocation: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = RowDataPacket & {
  total: string;
};

type UpdateLocationStatusResult =
  | Readonly<{
      kind: "UPDATED";
      location: BusinessLocation;
    }>
  | Readonly<{
      kind: "LOCATION_NOT_FOUND";
    }>
  | Readonly<{
      kind: "LAST_ACTIVE_LOCATION";
    }>;

const mapLocationRow = (row: LocationRow): BusinessLocation => ({
  id: row.id,
  businessId: row.businessId,
  code: row.code,
  name: row.name,
  locationType: row.locationType,
  address: row.address,
  countryCode: row.countryCode,
  departmentCode: row.departmentCode,
  departmentName: row.departmentName,
  municipalityCode: row.municipalityCode,
  municipalityName: row.municipalityName,
  postalCode: row.postalCode,
  phone: row.phone,
  email: row.email,
  isInventoryLocation: Boolean(row.isInventoryLocation),
  isProductionLocation: Boolean(row.isProductionLocation),
  isSalesLocation: Boolean(row.isSalesLocation),
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const locationSelect = `
  SELECT
    CAST(id AS CHAR) AS id,
    CAST(business_id AS CHAR) AS businessId,
    code,
    name,
    location_type AS locationType,
    address,
    country_code AS countryCode,
    department_code AS departmentCode,
    department_name AS departmentName,
    municipality_code AS municipalityCode,
    municipality_name AS municipalityName,
    postal_code AS postalCode,
    phone,
    email,
    is_inventory_location AS isInventoryLocation,
    is_production_location AS isProductionLocation,
    is_sales_location AS isSalesLocation,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM business_locations
`;

const findLocations = async (
  businessId: string,
): Promise<BusinessLocation[]> => {
  const [rows] = await databasePool.execute<LocationRow[]>(
    `
      ${locationSelect}
      WHERE business_id = ?
      ORDER BY
        is_active DESC,
        location_type ASC,
        name ASC,
        id ASC
    `,
    [businessId],
  );

  return rows.map(mapLocationRow);
};

const findLocationById = async (
  businessId: string,
  locationId: string,
): Promise<BusinessLocation | null> => {
  const [rows] = await databasePool.execute<LocationRow[]>(
    `
      ${locationSelect}
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, locationId],
  );

  return rows[0] ? mapLocationRow(rows[0]) : null;
};

const findLocationByCode = async (
  businessId: string,
  code: string,
): Promise<BusinessLocation | null> => {
  const [rows] = await databasePool.execute<LocationRow[]>(
    `
      ${locationSelect}
      WHERE
        business_id = ?
        AND code = ?
      LIMIT 1
    `,
    [businessId, code],
  );

  return rows[0] ? mapLocationRow(rows[0]) : null;
};

const insertLocation = async (
  businessId: string,
  data: CreateLocationData,
  capabilities: LocationCapabilities,
): Promise<BusinessLocation> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO business_locations (
        business_id,
        code,
        name,
        location_type,
        address,
        country_code,
        department_code,
        department_name,
        municipality_code,
        municipality_name,
        postal_code,
        phone,
        email,
        is_inventory_location,
        is_production_location,
        is_sales_location
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      businessId,
      data.code,
      data.name,
      data.locationType,
      data.address,
      data.countryCode,
      data.departmentCode,
      data.departmentName,
      data.municipalityCode,
      data.municipalityName,
      data.postalCode,
      data.phone,
      data.email,
      capabilities.isInventoryLocation,
      capabilities.isProductionLocation,
      capabilities.isSalesLocation,
    ],
  );

  const location = await findLocationById(
    businessId,
    result.insertId.toString(),
  );

  if (!location) {
    throw new Error("No fue posible recuperar la ubicación creada");
  }

  return location;
};

const updateLocationById = async (
  businessId: string,
  locationId: string,
  data: UpdateLocationData,
  capabilities: LocationCapabilities,
): Promise<BusinessLocation | null> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      UPDATE business_locations
      SET
        code = ?,
        name = ?,
        location_type = ?,
        address = ?,
        country_code = ?,
        department_code = ?,
        department_name = ?,
        municipality_code = ?,
        municipality_name = ?,
        postal_code = ?,
        phone = ?,
        email = ?,
        is_inventory_location = ?,
        is_production_location = ?,
        is_sales_location = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [
      data.code,
      data.name,
      data.locationType,
      data.address,
      data.countryCode,
      data.departmentCode,
      data.departmentName,
      data.municipalityCode,
      data.municipalityName,
      data.postalCode,
      data.phone,
      data.email,
      capabilities.isInventoryLocation,
      capabilities.isProductionLocation,
      capabilities.isSalesLocation,
      businessId,
      locationId,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findLocationById(businessId, locationId);
};

const updateLocationStatusById = async (
  businessId: string,
  locationId: string,
  isActive: boolean,
): Promise<UpdateLocationStatusResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [locationRows] = await connection.execute<LocationRow[]>(
      `
        ${locationSelect}
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, locationId],
    );

    const currentLocation = locationRows[0];

    if (!currentLocation) {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_FOUND",
      };
    }

    if (!isActive && Boolean(currentLocation.isActive)) {
      const [countRows] = await connection.execute<CountRow[]>(
        `
          SELECT CAST(COUNT(*) AS CHAR) AS total
          FROM business_locations
          WHERE
            business_id = ?
            AND is_active = TRUE
          FOR UPDATE
        `,
        [businessId],
      );

      if (Number(countRows[0]?.total ?? "0") <= 1) {
        await connection.rollback();

        return {
          kind: "LAST_ACTIVE_LOCATION",
        };
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE business_locations
        SET is_active = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [isActive, businessId, locationId],
    );

    await connection.commit();

    const location = await findLocationById(businessId, locationId);

    if (!location) {
      throw new Error("No fue posible recuperar la ubicación actualizada");
    }

    return {
      kind: "UPDATED",
      location,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  findLocationByCode,
  findLocationById,
  findLocations,
  insertLocation,
  updateLocationById,
  updateLocationStatusById,
};

export type { UpdateLocationStatusResult };
