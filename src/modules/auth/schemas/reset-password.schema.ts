import { z } from "zod";

const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i, "El token de recuperación no es válido"),

    newPassword: z
      .string()
      .min(12, "La nueva contraseña debe contener al menos 12 caracteres")
      .refine(
        (password) => Buffer.byteLength(password, "utf8") <= 72,
        "La contraseña supera el límite seguro de 72 bytes",
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

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export { resetPasswordSchema };
export type { ResetPasswordInput };
