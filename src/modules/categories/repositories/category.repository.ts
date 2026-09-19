import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  Category,
  CreateCategoryData,
  UpdateCategoryData,
} from "../category.types";

type CategoryRow = RowDataPacket & {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

const mapCategoryRow = (row: CategoryRow): Category => ({
  id: row.id,
  businessId: row.businessId,
  name: row.name,
  description: row.description,
  displayOrder: row.displayOrder,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const createCategory = async (
  businessId: string,
  data: CreateCategoryData,
): Promise<Category> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO categories (
        business_id,
        name,
        description,
        display_order
      )
      VALUES (?, ?, ?, ?)
    `,
    [businessId, data.name, data.description, data.displayOrder],
  );

  const categoryId = result.insertId.toString();

  const [rows] = await databasePool.execute<CategoryRow[]>(
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
      FROM categories
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, categoryId],
  );

  const category = rows[0];

  if (!category) {
    throw new Error("No fue posible recuperar la categoría creada");
  }

  return mapCategoryRow(category);
};

const findCategoriesByBusinessId = async (
  businessId: string,
): Promise<Category[]> => {
  const [rows] = await databasePool.execute<CategoryRow[]>(
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
      FROM categories
      WHERE business_id = ?
      ORDER BY
        display_order ASC,
        name ASC,
        id ASC
    `,
    [businessId],
  );

  return rows.map(mapCategoryRow);
};

const findCategoryById = async (
  businessId: string,
  categoryId: string,
): Promise<Category | null> => {
  const [rows] = await databasePool.execute<CategoryRow[]>(
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
      FROM categories
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, categoryId],
  );

  const category = rows[0];

  return category ? mapCategoryRow(category) : null;
};

const updateCategory = async (
  businessId: string,
  categoryId: string,
  data: UpdateCategoryData,
): Promise<Category> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE categories
      SET
        name = ?,
        description = ?,
        display_order = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [data.name, data.description, data.displayOrder, businessId, categoryId],
  );

  const category = await findCategoryById(businessId, categoryId);

  if (!category) {
    throw new Error("No fue posible recuperar la categoría actualizada");
  }

  return category;
};

const updateCategoryStatus = async (
  businessId: string,
  categoryId: string,
  isActive: boolean,
): Promise<Category> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE categories
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, categoryId],
  );

  const category = await findCategoryById(businessId, categoryId);

  if (!category) {
    throw new Error("No fue posible recuperar la categoría actualizada");
  }

  return category;
};

export {
  createCategory,
  findCategoriesByBusinessId,
  findCategoryById,
  updateCategory,
  updateCategoryStatus,
};
