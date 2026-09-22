import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  AssignableEmployeeRoleCode,
  BusinessRoleCode,
  CreateEmployeeData,
  Employee,
} from "../employee.types";

type RoleRow = RowDataPacket & {
  id: string;
  code: AssignableEmployeeRoleCode;
};

type EmployeeRow = RowDataPacket & {
  userId: string;
  membershipId: string;
  businessId: string;
  fullName: string;
  email: string;
  isActive: number;
  membershipIsActive: number;
  roleCode: BusinessRoleCode;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateEmployeeResult =
  | Readonly<{
      kind: "CREATED";
      employee: Employee;
    }>
  | Readonly<{
      kind: "ROLE_NOT_AVAILABLE";
    }>;

const mapEmployeeRows = (rows: readonly EmployeeRow[]): Employee => {
  const firstRow = rows[0];

  if (!firstRow) {
    throw new Error("No fue posible recuperar el empleado");
  }

  return {
    userId: firstRow.userId,
    membershipId: firstRow.membershipId,
    businessId: firstRow.businessId,
    fullName: firstRow.fullName,
    email: firstRow.email,
    isActive: Boolean(firstRow.isActive),
    membershipIsActive: Boolean(firstRow.membershipIsActive),
    roles: [...new Set(rows.map((row) => row.roleCode))],
    lastLoginAt: firstRow.lastLoginAt,
    createdAt: firstRow.createdAt,
    updatedAt: firstRow.updatedAt,
  };
};

const createEmployee = async (
  businessId: string,
  data: CreateEmployeeData,
): Promise<CreateEmployeeResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const rolePlaceholders = data.roles.map(() => "?").join(", ");

    const [roleRows] = await connection.execute<RoleRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          code
        FROM roles
        WHERE
          code IN (${rolePlaceholders})
          AND is_active = TRUE
        FOR SHARE
      `,
      [...data.roles],
    );

    if (roleRows.length !== data.roles.length) {
      await connection.rollback();

      return {
        kind: "ROLE_NOT_AVAILABLE",
      };
    }

    const [userResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO users (
          full_name,
          email,
          password_hash
        )
        VALUES (?, ?, ?)
      `,
      [data.fullName, data.email, data.passwordHash],
    );

    const userId = userResult.insertId.toString();

    const [membershipResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO business_memberships (
          business_id,
          user_id
        )
        VALUES (?, ?)
      `,
      [businessId, userId],
    );

    const membershipId = membershipResult.insertId.toString();

    for (const role of roleRows) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO business_membership_roles (
            business_membership_id,
            role_id
          )
          VALUES (?, ?)
        `,
        [membershipId, role.id],
      );
    }

    const [employeeRows] = await connection.execute<EmployeeRow[]>(
      `
        SELECT
          CAST(u.id AS CHAR) AS userId,
          CAST(bm.id AS CHAR) AS membershipId,
          CAST(bm.business_id AS CHAR) AS businessId,
          u.full_name AS fullName,
          u.email,
          u.is_active AS isActive,
          bm.is_active AS membershipIsActive,
          r.code AS roleCode,
          u.last_login_at AS lastLoginAt,
          bm.created_at AS createdAt,
          bm.updated_at AS updatedAt
        FROM business_memberships AS bm
        INNER JOIN users AS u
          ON u.id = bm.user_id
        INNER JOIN business_membership_roles AS bmr
          ON bmr.business_membership_id = bm.id
          AND bmr.is_active = TRUE
        INNER JOIN roles AS r
          ON r.id = bmr.role_id
          AND r.is_active = TRUE
        WHERE
          bm.business_id = ?
          AND bm.id = ?
        ORDER BY r.id ASC
      `,
      [businessId, membershipId],
    );

    const employee = mapEmployeeRows(employeeRows);

    await connection.commit();

    return {
      kind: "CREATED",
      employee,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const findEmployeesByBusinessId = async (
  businessId: string,
): Promise<Employee[]> => {
  const [rows] = await databasePool.execute<EmployeeRow[]>(
    `
      SELECT
        CAST(u.id AS CHAR) AS userId,
        CAST(bm.id AS CHAR) AS membershipId,
        CAST(bm.business_id AS CHAR) AS businessId,
        u.full_name AS fullName,
        u.email,
        u.is_active AS isActive,
        bm.is_active AS membershipIsActive,
        r.code AS roleCode,
        u.last_login_at AS lastLoginAt,
        bm.created_at AS createdAt,
        bm.updated_at AS updatedAt
      FROM business_memberships AS bm
      INNER JOIN users AS u
        ON u.id = bm.user_id
      INNER JOIN business_membership_roles AS bmr
        ON bmr.business_membership_id = bm.id
        AND bmr.is_active = TRUE
      INNER JOIN roles AS r
        ON r.id = bmr.role_id
        AND r.is_active = TRUE
      WHERE bm.business_id = ?
      ORDER BY
        u.full_name ASC,
        u.id ASC,
        r.id ASC
    `,
    [businessId],
  );

  const rowsByMembershipId = new Map<string, EmployeeRow[]>();

  for (const row of rows) {
    const employeeRows = rowsByMembershipId.get(row.membershipId) ?? [];

    employeeRows.push(row);
    rowsByMembershipId.set(row.membershipId, employeeRows);
  }

  return [...rowsByMembershipId.values()].map(mapEmployeeRows);
};

const findEmployeeByMembershipId = async (
  businessId: string,
  employeeMembershipId: string,
): Promise<Employee | null> => {
  const [rows] = await databasePool.execute<EmployeeRow[]>(
    `
      SELECT
        CAST(u.id AS CHAR) AS userId,
        CAST(bm.id AS CHAR) AS membershipId,
        CAST(bm.business_id AS CHAR) AS businessId,
        u.full_name AS fullName,
        u.email,
        u.is_active AS isActive,
        bm.is_active AS membershipIsActive,
        r.code AS roleCode,
        u.last_login_at AS lastLoginAt,
        bm.created_at AS createdAt,
        bm.updated_at AS updatedAt
      FROM business_memberships AS bm
      INNER JOIN users AS u
        ON u.id = bm.user_id
      INNER JOIN business_membership_roles AS bmr
        ON bmr.business_membership_id = bm.id
        AND bmr.is_active = TRUE
      INNER JOIN roles AS r
        ON r.id = bmr.role_id
        AND r.is_active = TRUE
      WHERE
        bm.business_id = ?
        AND bm.id = ?
      ORDER BY r.id ASC
    `,
    [businessId, employeeMembershipId],
  );

  return rows.length > 0 ? mapEmployeeRows(rows) : null;
};

const updateEmployeeMembershipStatus = async (
  businessId: string,
  employeeMembershipId: string,
  isActive: boolean,
): Promise<Employee | null> => {
  const currentEmployee = await findEmployeeByMembershipId(
    businessId,
    employeeMembershipId,
  );

  if (!currentEmployee) {
    return null;
  }

  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE business_memberships
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, employeeMembershipId],
  );

  return findEmployeeByMembershipId(businessId, employeeMembershipId);
};

export {
  createEmployee,
  findEmployeeByMembershipId,
  findEmployeesByBusinessId,
  updateEmployeeMembershipStatus,
};

export type { CreateEmployeeResult };
