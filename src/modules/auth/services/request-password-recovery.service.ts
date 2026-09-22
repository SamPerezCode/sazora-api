import { createHash, randomBytes } from "node:crypto";

import {
  createPasswordResetToken,
  findActiveUserIdByEmail,
} from "../repositories/password-recovery.repository";
import type { RequestPasswordRecoveryInput } from "../schemas/request-password-recovery.schema";
import { sendPasswordRecoveryEmail } from "./password-recovery-email.service";

const PASSWORD_RESET_TOKEN_DURATION_MINUTES = 30;

const hashPasswordResetToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const requestPasswordRecovery = async (
  input: RequestPasswordRecoveryInput,
): Promise<string | null> => {
  const userId = await findActiveUserIdByEmail(input.email);

  if (!userId) {
    return null;
  }

  const resetToken = randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(resetToken);

  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_DURATION_MINUTES * 60 * 1000,
  );

  await createPasswordResetToken(userId, tokenHash, expiresAt);

  await sendPasswordRecoveryEmail({
    recipientEmail: input.email,
    resetToken,
  });

  return resetToken;
};

export { hashPasswordResetToken, requestPasswordRecovery };
