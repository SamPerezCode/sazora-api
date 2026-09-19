import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("El correo electrónico no tiene un formato válido"),
  password: z
    .string()
    .min(8, "La contraseña debe contener al menos 8 caracteres")
    .refine(
      (password) => Buffer.byteLength(password, "utf8") <= 72,
      "La contraseña supera el límite seguro de 72 bytes",
    ),
  businessSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "El identificador del negocio no tiene un formato válido",
    ),
});

type LoginInput = z.infer<typeof loginSchema>;

export { loginSchema };
export type { LoginInput };
