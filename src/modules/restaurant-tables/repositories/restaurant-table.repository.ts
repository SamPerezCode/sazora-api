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
  code: string;
  name: string;
  capacity: number | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

const mapRestaurantTableRow = (row: RestaurantTableRow): RestaurantTable => ({
  id: row.id,
  businessId: row.businessId,
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
): Promise<RestaurantTable | null> => {
  const [rows] = await databasePool.execute<RestaurantTableRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        CAST(business_id AS CHAR) AS businessId,
        code,
        name,
        capacity,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM restaurant_tables
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, restaurantTableId],
  );

  const restaurantTable = rows[0];

  return restaurantTable ? mapRestaurantTableRow(restaurantTable) : null;
};

const findRestaurantTablesByBusinessId = async (
  businessId: string,
): Promise<RestaurantTable[]> => {
  const [rows] = await databasePool.execute<RestaurantTableRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        CAST(business_id AS CHAR) AS businessId,
        code,
        name,
        capacity,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM restaurant_tables
      WHERE business_id = ?
      ORDER BY
        name ASC,
        id ASC
    `,
    [businessId],
  );

  return rows.map(mapRestaurantTableRow);
};
const createRestaurantTable = async (
  businessId: string,
  data: CreateRestaurantTableData,
): Promise<RestaurantTable> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO restaurant_tables (
        business_id,
        code,
        name,
        capacity
      )
      VALUES (?, ?, ?, ?)
    `,
    [businessId, data.code, data.name, data.capacity],
  );

  const restaurantTable = await findRestaurantTableById(
    businessId,
    result.insertId.toString(),
  );

  if (!restaurantTable) {
    throw new Error("No fue posible recuperar la mesa creada");
  }

  return restaurantTable;
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
): Promise<RestaurantTable> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE restaurant_tables
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, restaurantTableId],
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

export {
  createRestaurantTable,
  findRestaurantTableById,
  findRestaurantTablesByBusinessId,
  updateRestaurantTable,
  updateRestaurantTableStatus,
};
