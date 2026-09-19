import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

// Tipo de cada fila de MySQL
type LoginIdentityRow = RowDataPacket & {
  userId: string;
  fullName: string;
  passwordHash: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  membershipId: string;
  roleCode: string;
};

// Identidad que utilizará la aplicación
type LoginIdentity = Readonly<{
  userId: string;
  fullName: string;
  passwordHash: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  membershipId: string;
  roles: string[];
}>;

type FindLoginIdentityInput = Readonly<{
  email: string;
  businessSlug: string;
}>;

const findLoginIdentity = async ({
  email,
  businessSlug,
}: FindLoginIdentityInput): Promise<LoginIdentity | null> => {
  const [rows] = await databasePool.execute<LoginIdentityRow[]>(
    `
      SELECT
        CAST(u.id AS CHAR) AS userId,
        u.full_name AS fullName,
        u.password_hash AS passwordHash,
        CAST(b.id AS CHAR) AS businessId,
        b.name AS businessName,
        b.slug AS businessSlug,
        CAST(bm.id AS CHAR) AS membershipId,
        r.code AS roleCode
      FROM users AS u
      INNER JOIN business_memberships AS bm
        ON bm.user_id = u.id
        AND bm.is_active = TRUE
      INNER JOIN businesses AS b
        ON b.id = bm.business_id
        AND b.is_active = TRUE
      INNER JOIN business_membership_roles AS bmr
        ON bmr.business_membership_id = bm.id
        AND bmr.is_active = TRUE
      INNER JOIN roles AS r
        ON r.id = bmr.role_id
        AND r.is_active = TRUE
      WHERE
        u.email = ?
        AND u.is_active = TRUE
        AND b.slug = ?
      ORDER BY r.id
    `,
    [email, businessSlug],
  );

  const firstRow = rows[0];

  if (!firstRow) {
    return null;
  }

  return {
    userId: firstRow.userId,
    fullName: firstRow.fullName,
    passwordHash: firstRow.passwordHash,
    businessId: firstRow.businessId,
    businessName: firstRow.businessName,
    businessSlug: firstRow.businessSlug,
    membershipId: firstRow.membershipId,
    roles: [...new Set(rows.map((row) => row.roleCode))],
  };
};

const updateLastLogin = async (userId: string): Promise<void> => {
  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
    `,
    [userId],
  );
};

export { findLoginIdentity, updateLastLogin };
export type { LoginIdentity };
