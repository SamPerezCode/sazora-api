import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

type PermissionRow = RowDataPacket & {
  code: string;
};

const findPermissionsForRoles = async (
  roles: readonly string[],
): Promise<string[]> => {
  const uniqueRoles = [...new Set(roles)];

  if (uniqueRoles.length === 0) {
    return [];
  }

  const placeholders = uniqueRoles.map(() => "?").join(", ");

  const [rows] = await databasePool.execute<PermissionRow[]>(
    `
      SELECT DISTINCT
        p.code
      FROM roles AS r
      INNER JOIN role_permissions AS rp
        ON rp.role_id = r.id
        AND rp.is_active = TRUE
      INNER JOIN permissions AS p
        ON p.id = rp.permission_id
        AND p.is_active = TRUE
      WHERE
        r.is_active = TRUE
        AND r.code IN (${placeholders})
      ORDER BY
        p.code ASC
    `,
    uniqueRoles,
  );

  return rows.map((row) => row.code);
};

export { findPermissionsForRoles };
