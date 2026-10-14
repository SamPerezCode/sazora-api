import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { LocationType } from "../../locations/location.types";
import type { PreparationAreaLocation } from "../preparation-area.types";

type PreparationAreaLocationRow = RowDataPacket & {
  preparationAreaId: string;
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  isActive: number;
};

type AvailableLocationRow = RowDataPacket & {
  id: string;
};

const findPreparationAreaLocations = async (
  businessId: string,
  preparationAreaIds: readonly string[],
): Promise<Map<string, PreparationAreaLocation[]>> => {
  const result = new Map<string, PreparationAreaLocation[]>();

  if (preparationAreaIds.length === 0) {
    return result;
  }

  const placeholders = preparationAreaIds.map(() => "?").join(", ");

  const [rows] = await databasePool.execute<PreparationAreaLocationRow[]>(
    `
      SELECT
        CAST(pal.preparation_area_id AS CHAR) AS preparationAreaId,
        CAST(bl.id AS CHAR) AS id,
        bl.code,
        bl.name,
        bl.location_type AS locationType,
        bl.is_active AS isActive
      FROM preparation_area_locations AS pal
      INNER JOIN business_locations AS bl
        ON bl.business_id = pal.business_id
        AND bl.id = pal.location_id
      WHERE
        pal.business_id = ?
        AND pal.preparation_area_id IN (${placeholders})
      ORDER BY
        bl.is_active DESC,
        bl.name ASC,
        bl.id ASC
    `,
    [businessId, ...preparationAreaIds],
  );

  for (const row of rows) {
    const locations = result.get(row.preparationAreaId) ?? [];

    locations.push({
      id: row.id,
      code: row.code,
      name: row.name,
      locationType: row.locationType,
      isActive: Boolean(row.isActive),
    });

    result.set(row.preparationAreaId, locations);
  }

  return result;
};

const findUnavailableLocationIds = async (
  connection: PoolConnection,
  businessId: string,
  locationIds: readonly string[],
): Promise<string[]> => {
  const sortedIds = [...locationIds].sort((first, second) => {
    const firstId = BigInt(first);
    const secondId = BigInt(second);

    if (firstId < secondId) {
      return -1;
    }

    if (firstId > secondId) {
      return 1;
    }

    return 0;
  });

  const placeholders = sortedIds.map(() => "?").join(", ");

  const [rows] = await connection.execute<AvailableLocationRow[]>(
    `
      SELECT CAST(id AS CHAR) AS id
      FROM business_locations
      WHERE
        business_id = ?
        AND id IN (${placeholders})
        AND is_active = TRUE
      ORDER BY id ASC
      FOR SHARE
    `,
    [businessId, ...sortedIds],
  );

  const availableIds = new Set(rows.map(({ id }) => id));

  return sortedIds.filter((locationId) => !availableIds.has(locationId));
};

const insertPreparationAreaLocations = async (
  connection: PoolConnection,
  businessId: string,
  preparationAreaId: string,
  locationIds: readonly string[],
): Promise<void> => {
  for (const locationId of locationIds) {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO preparation_area_locations (
          business_id,
          preparation_area_id,
          location_id
        )
        VALUES (?, ?, ?)
      `,
      [businessId, preparationAreaId, locationId],
    );
  }
};

const replacePreparationAreaLocations = async (
  connection: PoolConnection,
  businessId: string,
  preparationAreaId: string,
  locationIds: readonly string[],
): Promise<void> => {
  await connection.execute<ResultSetHeader>(
    `
      DELETE FROM preparation_area_locations
      WHERE
        business_id = ?
        AND preparation_area_id = ?
    `,
    [businessId, preparationAreaId],
  );

  await insertPreparationAreaLocations(
    connection,
    businessId,
    preparationAreaId,
    locationIds,
  );
};

export {
  findPreparationAreaLocations,
  findUnavailableLocationIds,
  insertPreparationAreaLocations,
  replacePreparationAreaLocations,
};
