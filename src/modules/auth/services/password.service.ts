import {
  compare as comparePassword,
  hash as createPasswordHash,
  truncates,
} from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 12;

const hashPassword = async (plainPassword: string): Promise<string> => {
  if (truncates(plainPassword)) {
    throw new Error("La contraseña supera el límite seguro de bcrypt");
  }

  return createPasswordHash(plainPassword, PASSWORD_SALT_ROUNDS);
};

const verifyPassword = async (
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> => comparePassword(plainPassword, passwordHash);

export { hashPassword, verifyPassword };
