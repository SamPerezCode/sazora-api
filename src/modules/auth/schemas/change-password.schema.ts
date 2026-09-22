import { z } from "zod";

const bcryptPasswordSchema = z
  .string()
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "La contraseña supera el límite seguro de 72 bytes",
  );

const changePasswordSchema = z
  .object({
    currentPassword: bcryptPasswordSchema.min(
      1,
      "La contraseña actual es obligatoria",
    ),

    newPassword: bcryptPasswordSchema.min(
      12,
      "La nueva contraseña debe contener al menos 12 caracteres",
    ),

    newPasswordConfirmation: z.string(),
  })
  .strict()
  .refine(
    ({ newPassword, newPasswordConfirmation }) =>
      newPassword === newPasswordConfirmation,
    {
      message: "Las nuevas contraseñas no coinciden",
      path: ["newPasswordConfirmation"],
    },
  );

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export { changePasswordSchema };
export type { ChangePasswordInput };
