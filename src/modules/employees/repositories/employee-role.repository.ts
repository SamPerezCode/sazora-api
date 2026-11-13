import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { AssignableEmployeeRoleCode } from "../employee.types";

type BusinessRow = RowDataPacket & {
  id: string;
};

type MembershipRow = RowDataPacket & {
  id: string;
};

type ActiveAdminRoleRow = RowDataPacket & {
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
      kind: "LAST_ACTIVE_ADMIN_ROLE_REMOVAL_NOT_ALLOWED";
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

    /*
     * El bloqueo del negocio serializa las modificaciones de roles.
     * Esto evita que dos administradores sean degradados al mismo tiempo
     * y que ambas operaciones crean que todavía existe otro administrador.
     */
    const [businessRows] = await connection.execute<BusinessRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
        FROM businesses
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId],
    );

    if (!businessRows[0]) {
      await connection.rollback();

      return {
        kind: "MEMBERSHIP_NOT_FOUND",
      };
    }

    const [membershipRows] = await connection.execute<MembershipRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
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

    /*
     * Determinar si la membresía seleccionada representa actualmente
     * a un administrador activo.
     */
    const [currentAdminRows] = await connection.execute<ActiveAdminRoleRow[]>(
      `
          SELECT CAST(bmr.id AS CHAR) AS id
          FROM business_membership_roles AS bmr
          INNER JOIN roles AS r
            ON r.id = bmr.role_id
          INNER JOIN business_memberships AS bm
            ON bm.id = bmr.business_membership_id
          INNER JOIN users AS u
            ON u.id = bm.user_id
          WHERE
            bm.business_id = ?
            AND bm.id = ?
            AND bm.is_active = TRUE
            AND u.is_active = TRUE
            AND bmr.is_active = TRUE
            AND r.is_active = TRUE
            AND r.code = 'ADMIN'
          LIMIT 1
        `,
      [businessId, employeeMembershipId],
    );

    const isRemovingAdminRole =
      Boolean(currentAdminRows[0]) && !roles.includes("ADMIN");

    if (isRemovingAdminRole) {
      /*
       * Antes de retirar ADMIN, debe existir otro administrador activo
       * perteneciente al mismo negocio.
       */
      const [otherAdminRows] = await connection.execute<ActiveAdminRoleRow[]>(
        `
            SELECT CAST(bmr.id AS CHAR) AS id
            FROM business_membership_roles AS bmr
            INNER JOIN roles AS r
              ON r.id = bmr.role_id
            INNER JOIN business_memberships AS bm
              ON bm.id = bmr.business_membership_id
            INNER JOIN users AS u
              ON u.id = bm.user_id
            WHERE
              bm.business_id = ?
              AND bm.id <> ?
              AND bm.is_active = TRUE
              AND u.is_active = TRUE
              AND bmr.is_active = TRUE
              AND r.is_active = TRUE
              AND r.code = 'ADMIN'
            LIMIT 1
          `,
        [businessId, employeeMembershipId],
      );

      if (!otherAdminRows[0]) {
        await connection.rollback();

        return {
          kind: "LAST_ACTIVE_ADMIN_ROLE_REMOVAL_NOT_ALLOWED",
        };
      }
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
