import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreatePreparationAreaData,
  PreparationArea,
  UpdatePreparationAreaData,
} from "../preparation-area.types";
import {
  findPreparationAreaLocations,
  findUnavailableLocationIds,
  insertPreparationAreaLocations,
  replacePreparationAreaLocations,
} from "./preparation-area-location.repository";

type PreparationAreaRow = RowDataPacket & {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type LockedAreaRow = RowDataPacket & {
  id: string;
};

type PreparationAreaUpdatedResult = Readonly<{
  kind: "UPDATED";
  preparationArea: PreparationArea;
}>;

type PreparationAreaLocationsNotAvailableResult = Readonly<{
  kind: "LOCATIONS_NOT_AVAILABLE";
  locationIds: readonly string[];
}>;

type CreatePreparationAreaResult =
  PreparationAreaUpdatedResult | PreparationAreaLocationsNotAvailableResult;

type UpdatePreparationAreaResult =
  | PreparationAreaUpdatedResult
  | PreparationAreaLocationsNotAvailableResult
  | Readonly<{
      kind: "PREPARATION_AREA_NOT_FOUND";
    }>;

const mapRows = async (
  businessId: string,
  rows: PreparationAreaRow[],
): Promise<PreparationArea[]> => {
  const areaIds = rows.map(({ id }) => id);
  const locationsByArea = await findPreparationAreaLocations(
    businessId,
    areaIds,
  );

  return rows.map((row) => ({
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    description: row.description,
    displayOrder: row.displayOrder,
    isActive: Boolean(row.isActive),
    locations: locationsByArea.get(row.id) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

const findPreparationAreasByBusinessId = async (
  businessId: string,
  locationId?: string,
  activeOnly = false,
): Promise<PreparationArea[]> => {
  const conditions = ["pa.business_id = ?"];
  const values: string[] = [businessId];

  if (locationId !== undefined) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM preparation_area_locations AS pal
        WHERE
          pal.business_id = pa.business_id
          AND pal.preparation_area_id = pa.id
          AND pal.location_id = ?
      )
    `);

    values.push(locationId);
  }

  if (activeOnly) {
    conditions.push("pa.is_active = TRUE");
  }

  const [rows] = await databasePool.execute<PreparationAreaRow[]>(
    `
      SELECT
        CAST(pa.id AS CHAR) AS id,
        CAST(pa.business_id AS CHAR) AS businessId,
        pa.name,
        pa.description,
        pa.display_order AS displayOrder,
        pa.is_active AS isActive,
        pa.created_at AS createdAt,
        pa.updated_at AS updatedAt
      FROM preparation_areas AS pa
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        pa.display_order ASC,
        pa.name ASC,
        pa.id ASC
    `,
    values,
  );

  return mapRows(businessId, rows);
};

const findPreparationAreaById = async (
  businessId: string,
  preparationAreaId: string,
  locationId?: string,
  activeOnly = false,
): Promise<PreparationArea | null> => {
  const conditions = ["pa.business_id = ?", "pa.id = ?"];

  const values: string[] = [businessId, preparationAreaId];

  if (locationId !== undefined) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM preparation_area_locations AS pal
        WHERE
          pal.business_id = pa.business_id
          AND pal.preparation_area_id = pa.id
          AND pal.location_id = ?
      )
    `);

    values.push(locationId);
  }

  if (activeOnly) {
    conditions.push("pa.is_active = TRUE");
  }

  const [rows] = await databasePool.execute<PreparationAreaRow[]>(
    `
      SELECT
        CAST(pa.id AS CHAR) AS id,
        CAST(pa.business_id AS CHAR) AS businessId,
        pa.name,
        pa.description,
        pa.display_order AS displayOrder,
        pa.is_active AS isActive,
        pa.created_at AS createdAt,
        pa.updated_at AS updatedAt
      FROM preparation_areas AS pa
      WHERE ${conditions.join(" AND ")}
      LIMIT 1
    `,
    values,
  );

  const mapped = await mapRows(businessId, rows);

  return mapped[0] ?? null;
};

const createPreparationArea = async (
  businessId: string,
  data: CreatePreparationAreaData,
): Promise<CreatePreparationAreaResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const unavailableLocationIds = await findUnavailableLocationIds(
      connection,
      businessId,
      data.locationIds,
    );

    if (unavailableLocationIds.length > 0) {
      await connection.rollback();

      return {
        kind: "LOCATIONS_NOT_AVAILABLE",
        locationIds: unavailableLocationIds,
      };
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO preparation_areas (
          business_id,
          name,
          description,
          display_order
        )
        VALUES (?, ?, ?, ?)
      `,
      [businessId, data.name, data.description, data.displayOrder],
    );

    const preparationAreaId = result.insertId.toString();

    await insertPreparationAreaLocations(
      connection,
      businessId,
      preparationAreaId,
      data.locationIds,
    );

    await connection.commit();

    const preparationArea = await findPreparationAreaById(
      businessId,
      preparationAreaId,
    );

    if (!preparationArea) {
      throw new Error("No fue posible recuperar el área creada");
    }

    return {
      kind: "UPDATED",
      preparationArea,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updatePreparationArea = async (
  businessId: string,
  preparationAreaId: string,
  data: UpdatePreparationAreaData,
): Promise<UpdatePreparationAreaResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [areaRows] = await connection.execute<LockedAreaRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
        FROM preparation_areas
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, preparationAreaId],
    );

    if (!areaRows[0]) {
      await connection.rollback();

      return {
        kind: "PREPARATION_AREA_NOT_FOUND",
      };
    }

    if (data.locationIds !== null) {
      const unavailableLocationIds = await findUnavailableLocationIds(
        connection,
        businessId,
        data.locationIds,
      );

      if (unavailableLocationIds.length > 0) {
        await connection.rollback();

        return {
          kind: "LOCATIONS_NOT_AVAILABLE",
          locationIds: unavailableLocationIds,
        };
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE preparation_areas
        SET
          name = ?,
          description = ?,
          display_order = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        data.name,
        data.description,
        data.displayOrder,
        businessId,
        preparationAreaId,
      ],
    );

    if (data.locationIds !== null) {
      await replacePreparationAreaLocations(
        connection,
        businessId,
        preparationAreaId,
        data.locationIds,
      );
    }

    await connection.commit();

    const preparationArea = await findPreparationAreaById(
      businessId,
      preparationAreaId,
    );

    if (!preparationArea) {
      throw new Error("No fue posible recuperar el área actualizada");
    }

    return {
      kind: "UPDATED",
      preparationArea,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updatePreparationAreaStatus = async (
  businessId: string,
  preparationAreaId: string,
  isActive: boolean,
): Promise<PreparationArea> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE preparation_areas
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, preparationAreaId],
  );

  const preparationArea = await findPreparationAreaById(
    businessId,
    preparationAreaId,
  );

  if (!preparationArea) {
    throw new Error("No fue posible recuperar el área actualizada");
  }

  return preparationArea;
};

export {
  createPreparationArea,
  findPreparationAreaById,
  findPreparationAreasByBusinessId,
  updatePreparationArea,
  updatePreparationAreaStatus,
};
