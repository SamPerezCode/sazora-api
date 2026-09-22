import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

type EmployeeIdentityRow = RowDataPacket & {
  userId: string;
};

type AdminRoleRow = RowDataPacket & {
  id: string;
};

type MembershipCountRow = RowDataPacket & {
  membershipCount: string;
};

type UpdateEmployeeData = Readonly<{
  fullName: string | undefined;
  email: string | undefined;
}>;

type UpdateEmployeeRecordResult =
  | Readonly<{
      kind: "UPDATED";
    }>
  | Readonly<{
      kind: "EMPLOYEE_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ADMIN_IDENTITY_NOT_EDITABLE";
    }>
  | Readonly<{
      kind: "SHARED_IDENTITY_NOT_EDITABLE";
    }>;

const updateEmployeeRecord = async (
  businessId: string,
  employeeMembershipId: string,
  data: UpdateEmployeeData,
): Promise<UpdateEmployeeRecordResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [identityRows] = await connection.execute<EmployeeIdentityRow[]>(
      `
        SELECT
          CAST(u.id AS CHAR) AS userId
        FROM business_memberships AS bm
        INNER JOIN users AS u
          ON u.id = bm.user_id
        WHERE
          bm.business_id = ?
          AND bm.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, employeeMembershipId],
    );

    const identity = identityRows[0];

    if (!identity) {
      await connection.rollback();

      return {
        kind: "EMPLOYEE_NOT_FOUND",
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
        kind: "ADMIN_IDENTITY_NOT_EDITABLE",
      };
    }

    const [membershipCountRows] = await connection.execute<
      MembershipCountRow[]
    >(
      `
          SELECT
            CAST(COUNT(*) AS CHAR) AS membershipCount
          FROM business_memberships
          WHERE user_id = ?
        `,
      [identity.userId],
    );

    const membershipCount = Number(
      membershipCountRows[0]?.membershipCount ?? 0,
    );

    if (membershipCount > 1) {
      await connection.rollback();

      return {
        kind: "SHARED_IDENTITY_NOT_EDITABLE",
      };
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET
          full_name = COALESCE(?, full_name),
          email = COALESCE(?, email)
        WHERE id = ?
      `,
      [data.fullName ?? null, data.email ?? null, identity.userId],
    );

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

export { updateEmployeeRecord };
export type { UpdateEmployeeData, UpdateEmployeeRecordResult };
