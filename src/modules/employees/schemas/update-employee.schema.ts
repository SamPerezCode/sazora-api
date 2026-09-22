import { z } from "zod";

const updateEmployeeSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(150, "El nombre no puede superar 150 caracteres")
      .optional(),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo electrónico no es válido")
      .max(254, "El correo no puede superar 254 caracteres")
      .optional(),
  })
  .strict()
  .refine(
    ({ fullName, email }) => fullName !== undefined || email !== undefined,
    {
      message: "Debes enviar al menos un campo para actualizar",
    },
  );

type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export { updateEmployeeSchema };
export type { UpdateEmployeeInput };
