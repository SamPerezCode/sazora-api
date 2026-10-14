import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreateRestaurantTableData,
  RestaurantTable,
  UpdateRestaurantTableData,
} from "../restaurant-table.types";

type RestaurantTableRow = RowDataPacket & {
  id: string;
  businessId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: "POINT_OF_SALE";
  locationIsActive: number;
  code: string;
  name: string;
  capacity: number | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type LocationStateRow = RowDataPacket & {
  id: string;
  locationType: "PRODUCTION_WAREHOUSE" | "POINT_OF_SALE";
  isActive: number;
};

type RestaurantTableStateRow = RowDataPacket & {
  isActive: number;
};

type ActiveOrderRow = RowDataPacket & {
  id: string;
};

type CreateRestaurantTableResult =
  | Readonly<{
      kind: "CREATED";
      restaurantTable: RestaurantTable;
    }>
  | Readonly<{
      kind: "LOCATION_NOT_AVAILABLE";
    }>
  | Readonly<{
      kind: "LOCATION_NOT_POINT_OF_SALE";
    }>;

type UpdateRestaurantTableStatusResult =
  | Readonly<{
      kind: "UPDATED";
      restaurantTable: RestaurantTable;
    }>
  | Readonly<{
      kind: "RESTAURANT_TABLE_NOT_FOUND";
    }>
  | Readonly<{
      kind: "RESTAURANT_TABLE_HAS_ACTIVE_ORDER";
    }>;

const restaurantTableSelect = `
  SELECT
    CAST(rt.id AS CHAR) AS id,
    CAST(rt.business_id AS CHAR) AS businessId,
    CAST(rt.location_id AS CHAR) AS locationId,
    bl.code AS locationCode,
    bl.name AS locationName,
    bl.location_type AS locationType,
    bl.is_active AS locationIsActive,
    rt.code,
    rt.name,
    rt.capacity,
    rt.is_active AS isActive,
    rt.created_at AS createdAt,
    rt.updated_at AS updatedAt
  FROM restaurant_tables AS rt
  INNER JOIN business_locations AS bl
    ON bl.business_id = rt.business_id
    AND bl.id = rt.location_id
`;

const mapRestaurantTableRow = (row: RestaurantTableRow): RestaurantTable => ({
  id: row.id,
  businessId: row.businessId,
  locationId: row.locationId,
  location: {
    id: row.locationId,
    code: row.locationCode,
    name: row.locationName,
    locationType: row.locationType,
    isActive: Boolean(row.locationIsActive),
  },
  code: row.code,
  name: row.name,
  capacity: row.capacity,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findRestaurantTableById = async (
  businessId: string,
  restaurantTableId: string,
  locationId?: string,
  activeOnly = false,
): Promise<RestaurantTable | null> => {
  const conditions = ["rt.business_id = ?", "rt.id = ?"];

  const values: string[] = [businessId, restaurantTableId];

  if (locationId !== undefined) {
    conditions.push("rt.location_id = ?");
    values.push(locationId);
  }

  if (activeOnly) {
    conditions.push("rt.is_active = TRUE");
  }

  const [rows] = await databasePool.execute<RestaurantTableRow[]>(
    `
      ${restaurantTableSelect}
      WHERE ${conditions.join(" AND ")}
      LIMIT 1
    `,
    values,
  );

  const restaurantTable = rows[0];

  return restaurantTable ? mapRestaurantTableRow(restaurantTable) : null;
};

const findRestaurantTablesByBusinessId = async (
  businessId: string,
  locationId?: string,
  activeOnly = false,
): Promise<RestaurantTable[]> => {
  const conditions = ["rt.business_id = ?"];
  const values: string[] = [businessId];

  if (locationId !== undefined) {
    conditions.push("rt.location_id = ?");
    values.push(locationId);
  }

  if (activeOnly) {
    conditions.push("rt.is_active = TRUE");
  }

  const [rows] = await databasePool.execute<RestaurantTableRow[]>(
    `
      ${restaurantTableSelect}
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        bl.name ASC,
        rt.name ASC,
        rt.id ASC
    `,
    values,
  );

  return rows.map(mapRestaurantTableRow);
};

const createRestaurantTable = async (
  businessId: string,
  data: CreateRestaurantTableData,
): Promise<CreateRestaurantTableResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [locationRows] = await connection.execute<LocationStateRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          location_type AS locationType,
          is_active AS isActive
        FROM business_locations
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR SHARE
      `,
      [businessId, data.locationId],
    );

    const location = locationRows[0];

    if (!location || location.isActive === 0) {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_AVAILABLE",
      };
    }

    if (location.locationType !== "POINT_OF_SALE") {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_POINT_OF_SALE",
      };
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO restaurant_tables (
          business_id,
          location_id,
          code,
          name,
          capacity
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [businessId, data.locationId, data.code, data.name, data.capacity],
    );

    await connection.commit();

    const restaurantTable = await findRestaurantTableById(
      businessId,
      result.insertId.toString(),
    );

    if (!restaurantTable) {
      throw new Error("No fue posible recuperar la mesa creada");
    }

    return {
      kind: "CREATED",
      restaurantTable,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateRestaurantTable = async (
  businessId: string,
  restaurantTableId: string,
  data: UpdateRestaurantTableData,
): Promise<RestaurantTable> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE restaurant_tables
      SET
        code = ?,
        name = ?,
        capacity = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [data.code, data.name, data.capacity, businessId, restaurantTableId],
  );

  const restaurantTable = await findRestaurantTableById(
    businessId,
    restaurantTableId,
  );

  if (!restaurantTable) {
    throw new Error("No fue posible recuperar la mesa actualizada");
  }

  return restaurantTable;
};

const updateRestaurantTableStatus = async (
  businessId: string,
  restaurantTableId: string,
  isActive: boolean,
): Promise<UpdateRestaurantTableStatusResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [tableRows] = await connection.execute<RestaurantTableStateRow[]>(
      `
          SELECT is_active AS isActive
          FROM restaurant_tables
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, restaurantTableId],
    );

    const currentTable = tableRows[0];

    if (!currentTable) {
      await connection.rollback();

      return {
        kind: "RESTAURANT_TABLE_NOT_FOUND",
      };
    }

    if (!isActive && Boolean(currentTable.isActive)) {
      const [activeOrderRows] = await connection.execute<ActiveOrderRow[]>(
        `
            SELECT CAST(id AS CHAR) AS id
            FROM orders
            WHERE
              business_id = ?
              AND restaurant_table_id = ?
              AND status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED'
              )
            LIMIT 1
          `,
        [businessId, restaurantTableId],
      );

      if (activeOrderRows[0]) {
        await connection.rollback();

        return {
          kind: "RESTAURANT_TABLE_HAS_ACTIVE_ORDER",
        };
      }
    }

    if (Boolean(currentTable.isActive) !== isActive) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE restaurant_tables
          SET is_active = ?
          WHERE
            business_id = ?
            AND id = ?
        `,
        [isActive, businessId, restaurantTableId],
      );
    }

    await connection.commit();

    const restaurantTable = await findRestaurantTableById(
      businessId,
      restaurantTableId,
    );

    if (!restaurantTable) {
      throw new Error("No fue posible recuperar la mesa actualizada");
    }

    return {
      kind: "UPDATED",
      restaurantTable,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  createRestaurantTable,
  findRestaurantTableById,
  findRestaurantTablesByBusinessId,
  updateRestaurantTable,
  updateRestaurantTableStatus,
};

export type { CreateRestaurantTableResult, UpdateRestaurantTableStatusResult };
