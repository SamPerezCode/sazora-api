import { AppError } from "../../../shared/errors/app-error";
import {
  findPasswordIdentityByUserId,
  updatePasswordAndAuthVersion,
} from "../repositories/password.repository";
import type { ChangePasswordInput } from "../schemas/change-password.schema";
import { hashPassword, verifyPassword } from "./password.service";

const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
): Promise<void> => {
  const currentPasswordHash = await findPasswordIdentityByUserId(userId);

  if (!currentPasswordHash) {
    throw new AppError(
      "La sesión ya no es válida",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const currentPasswordIsValid = await verifyPassword(
    input.currentPassword,
    currentPasswordHash,
  );

  if (!currentPasswordIsValid) {
    throw new AppError(
      "La contraseña actual no es correcta",
      400,
      "INVALID_CURRENT_PASSWORD",
    );
  }

  const passwordWasNotChanged = await verifyPassword(
    input.newPassword,
    currentPasswordHash,
  );

  if (passwordWasNotChanged) {
    throw new AppError(
      "La nueva contraseña debe ser diferente de la actual",
      409,
      "PASSWORD_UNCHANGED",
    );
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  const passwordWasUpdated = await updatePasswordAndAuthVersion(
    userId,
    currentPasswordHash,
    newPasswordHash,
  );

  if (!passwordWasUpdated) {
    throw new AppError(
      "La contraseña fue modificada desde otra sesión. Inicia sesión nuevamente",
      409,
      "PASSWORD_UPDATE_CONFLICT",
    );
  }
};

export { changePassword };
