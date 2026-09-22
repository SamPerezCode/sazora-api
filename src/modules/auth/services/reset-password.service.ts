import { AppError } from "../../../shared/errors/app-error";
import {
  consumePasswordResetToken,
  passwordResetTokenIsValid,
} from "../repositories/password-recovery.repository";
import type { ResetPasswordInput } from "../schemas/reset-password.schema";
import { hashPassword } from "./password.service";
import { hashPasswordResetToken } from "./request-password-recovery.service";

const createInvalidResetTokenError = (): AppError =>
  new AppError(
    "El token de recuperación no es válido o ya venció",
    400,
    "INVALID_PASSWORD_RESET_TOKEN",
  );

const resetPassword = async (input: ResetPasswordInput): Promise<void> => {
  const tokenHash = hashPasswordResetToken(input.token);

  const tokenIsValid = await passwordResetTokenIsValid(tokenHash);

  if (!tokenIsValid) {
    throw createInvalidResetTokenError();
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  const passwordWasReset = await consumePasswordResetToken(
    tokenHash,
    newPasswordHash,
  );

  if (!passwordWasReset) {
    throw createInvalidResetTokenError();
  }
};

export { resetPassword };
