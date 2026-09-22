import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

type ActiveUserRow = RowDataPacket & {
  userId: string;
};

type PasswordResetTokenRow = RowDataPacket & {
  resetTokenId: string;
  userId: string;
};

const findActiveUserIdByEmail = async (
  email: string,
): Promise<string | null> => {
  const [rows] = await databasePool.execute<ActiveUserRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS userId
      FROM users
      WHERE
        email = ?
        AND is_active = TRUE
      LIMIT 1
    `,
    [email],
  );

  return rows[0]?.userId ?? null;
};

const createPasswordResetToken = async (
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute<ResultSetHeader>(
      `
        UPDATE password_reset_tokens
        SET invalidated_at = CURRENT_TIMESTAMP(3)
        WHERE
          user_id = ?
          AND used_at IS NULL
          AND invalidated_at IS NULL
      `,
      [userId],
    );

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO password_reset_tokens (
          user_id,
          token_hash,
          expires_at
        )
        VALUES (?, ?, ?)
      `,
      [userId, tokenHash, expiresAt],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const passwordResetTokenIsValid = async (
  tokenHash: string,
): Promise<boolean> => {
  const [rows] = await databasePool.execute<PasswordResetTokenRow[]>(
    `
      SELECT
        CAST(prt.id AS CHAR) AS resetTokenId,
        CAST(prt.user_id AS CHAR) AS userId
      FROM password_reset_tokens AS prt
      INNER JOIN users AS u
        ON u.id = prt.user_id
        AND u.is_active = TRUE
      WHERE
        prt.token_hash = ?
        AND prt.used_at IS NULL
        AND prt.invalidated_at IS NULL
        AND prt.expires_at > CURRENT_TIMESTAMP(3)
      LIMIT 1
    `,
    [tokenHash],
  );

  return rows.length > 0;
};

const consumePasswordResetToken = async (
  tokenHash: string,
  newPasswordHash: string,
): Promise<boolean> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [tokenRows] = await connection.execute<PasswordResetTokenRow[]>(
      `
          SELECT
            CAST(prt.id AS CHAR) AS resetTokenId,
            CAST(prt.user_id AS CHAR) AS userId
          FROM password_reset_tokens AS prt
          INNER JOIN users AS u
            ON u.id = prt.user_id
            AND u.is_active = TRUE
          WHERE
            prt.token_hash = ?
            AND prt.used_at IS NULL
            AND prt.invalidated_at IS NULL
            AND prt.expires_at > CURRENT_TIMESTAMP(3)
          LIMIT 1
          FOR UPDATE
        `,
      [tokenHash],
    );

    const resetToken = tokenRows[0];

    if (!resetToken) {
      await connection.rollback();
      return false;
    }

    const [userUpdateResult] = await connection.execute<ResultSetHeader>(
      `
          UPDATE users
          SET
            password_hash = ?,
            auth_version = auth_version + 1
          WHERE
            id = ?
            AND is_active = TRUE
        `,
      [newPasswordHash, resetToken.userId],
    );

    if (userUpdateResult.affectedRows !== 1) {
      await connection.rollback();
      return false;
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
      `,
      [resetToken.resetTokenId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE password_reset_tokens
        SET invalidated_at = CURRENT_TIMESTAMP(3)
        WHERE
          user_id = ?
          AND id <> ?
          AND used_at IS NULL
          AND invalidated_at IS NULL
      `,
      [resetToken.userId, resetToken.resetTokenId],
    );

    await connection.commit();

    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  consumePasswordResetToken,
  createPasswordResetToken,
  findActiveUserIdByEmail,
  passwordResetTokenIsValid,
};
