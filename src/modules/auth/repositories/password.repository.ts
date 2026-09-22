import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

type PasswordIdentityRow = RowDataPacket & {
  passwordHash: string;
};

const findPasswordIdentityByUserId = async (
  userId: string,
): Promise<string | null> => {
  const [rows] = await databasePool.execute<PasswordIdentityRow[]>(
    `
      SELECT
        password_hash AS passwordHash
      FROM users
      WHERE
        id = ?
        AND is_active = TRUE
      LIMIT 1
    `,
    [userId],
  );

  return rows[0]?.passwordHash ?? null;
};

const updatePasswordAndAuthVersion = async (
  userId: string,
  expectedPasswordHash: string,
  newPasswordHash: string,
): Promise<boolean> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      UPDATE users
      SET
        password_hash = ?,
        auth_version = auth_version + 1
      WHERE
        id = ?
        AND is_active = TRUE
        AND password_hash = ?
    `,
    [newPasswordHash, userId, expectedPasswordHash],
  );

  return result.affectedRows === 1;
};

export { findPasswordIdentityByUserId, updatePasswordAndAuthVersion };
