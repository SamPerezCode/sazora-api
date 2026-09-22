import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "La contraseña debe contener al menos 12 caracteres")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "La contraseña supera el límite seguro de 72 bytes",
  );

const createEmployeeSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(150, "El nombre no puede superar 150 caracteres"),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo electrónico no es válido")
      .max(254, "El correo no puede superar 254 caracteres"),

    password: passwordSchema,

    passwordConfirmation: z.string(),

    roles: z
      .array(z.enum(["WAITER", "KITCHEN"]))
      .min(1, "Debes asignar al menos un rol")
      .max(2, "No puedes asignar más de dos roles")
      .transform((roles) => [...new Set(roles)]),
  })
  .strict()
  .refine(
    ({ password, passwordConfirmation }) => password === passwordConfirmation,
    {
      message: "Las contraseñas no coinciden",
      path: ["passwordConfirmation"],
    },
  );

type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export { createEmployeeSchema };
export type { CreateEmployeeInput };
