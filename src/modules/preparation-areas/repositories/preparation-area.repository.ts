import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreatePreparationAreaData,
  PreparationArea,
  UpdatePreparationAreaData,
} from "../preparation-area.types";

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

const mapPreparationAreaRow = (row: PreparationAreaRow): PreparationArea => ({
  id: row.id,
  businessId: row.businessId,
  name: row.name,
  description: row.description,
  displayOrder: row.displayOrder,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const createPreparationArea = async (
  businessId: string,
  data: CreatePreparationAreaData,
): Promise<PreparationArea> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
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

  const [rows] = await databasePool.execute<PreparationAreaRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        CAST(business_id AS CHAR) AS businessId,
        name,
        description,
        display_order AS displayOrder,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM preparation_areas
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, preparationAreaId],
  );

  const preparationArea = rows[0];

  if (!preparationArea) {
    throw new Error("No fue posible recuperar el área de preparación creada");
  }

  return mapPreparationAreaRow(preparationArea);
};

const findPreparationAreasByBusinessId = async (
  businessId: string,
): Promise<PreparationArea[]> => {
  const [rows] = await databasePool.execute<PreparationAreaRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        CAST(business_id AS CHAR) AS businessId,
        name,
        description,
        display_order AS displayOrder,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM preparation_areas
      WHERE business_id = ?
      ORDER BY
        display_order ASC,
        name ASC,
        id ASC
    `,
    [businessId],
  );

  return rows.map(mapPreparationAreaRow);
};

const findPreparationAreaById = async (
  businessId: string,
  preparationAreaId: string,
): Promise<PreparationArea | null> => {
  const [rows] = await databasePool.execute<PreparationAreaRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        CAST(business_id AS CHAR) AS businessId,
        name,
        description,
        display_order AS displayOrder,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM preparation_areas
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, preparationAreaId],
  );

  const preparationArea = rows[0];

  return preparationArea ? mapPreparationAreaRow(preparationArea) : null;
};

const updatePreparationArea = async (
  businessId: string,
  preparationAreaId: string,
  data: UpdatePreparationAreaData,
): Promise<PreparationArea> => {
  await databasePool.execute<ResultSetHeader>(
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

  const preparationArea = await findPreparationAreaById(
    businessId,
    preparationAreaId,
  );

  if (!preparationArea) {
    throw new Error("No fue posible recuperar el área actualizada");
  }

  return preparationArea;
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
