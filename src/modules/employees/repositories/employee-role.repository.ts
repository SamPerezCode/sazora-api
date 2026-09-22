import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { AssignableEmployeeRoleCode } from "../employee.types";

type MembershipRow = RowDataPacket & {
  id: string;
};

type AdminRoleRow = RowDataPacket & {
  id: string;
};

type RoleRow = RowDataPacket & {
  id: string;
  code: AssignableEmployeeRoleCode;
};

type ReplaceEmployeeRolesResult =
  | Readonly<{
      kind: "UPDATED";
    }>
  | Readonly<{
      kind: "MEMBERSHIP_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ADMIN_MEMBERSHIP_NOT_EDITABLE";
    }>
  | Readonly<{
      kind: "ROLE_NOT_AVAILABLE";
    }>;

const replaceEmployeeRoles = async (
  businessId: string,
  employeeMembershipId: string,
  roles: readonly AssignableEmployeeRoleCode[],
): Promise<ReplaceEmployeeRolesResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [membershipRows] = await connection.execute<MembershipRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id
        FROM business_memberships
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, employeeMembershipId],
    );

    if (!membershipRows[0]) {
      await connection.rollback();

      return {
        kind: "MEMBERSHIP_NOT_FOUND",
      };
    }

    const [adminRoleRows] = await connection.execute<AdminRoleRow[]>(
      `
        SELECT
          CAST(bmr.id AS CHAR) AS id
        FROM business_membership_roles AS bmr
        INNER JOIN roles AS r
          ON r.id = bmr.role_id
        WHERE
          bmr.business_membership_id = ?
          AND bmr.is_active = TRUE
          AND r.is_active = TRUE
          AND r.code = 'ADMIN'
        LIMIT 1
      `,
      [employeeMembershipId],
    );

    if (adminRoleRows[0]) {
      await connection.rollback();

      return {
        kind: "ADMIN_MEMBERSHIP_NOT_EDITABLE",
      };
    }

    const rolePlaceholders = roles.map(() => "?").join(", ");

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
      [...roles],
    );

    if (roleRows.length !== roles.length) {
      await connection.rollback();

      return {
        kind: "ROLE_NOT_AVAILABLE",
      };
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE business_membership_roles
        SET is_active = FALSE
        WHERE business_membership_id = ?
      `,
      [employeeMembershipId],
    );

    for (const role of roleRows) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO business_membership_roles (
            business_membership_id,
            role_id,
            is_active
          )
          VALUES (?, ?, TRUE)
          ON DUPLICATE KEY UPDATE
            is_active = TRUE
        `,
        [employeeMembershipId, role.id],
      );
    }

    await connection.commit();

    return {
      kind: "UPDATED",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { replaceEmployeeRoles };
export type { ReplaceEmployeeRolesResult };
