import { z } from "zod";

const updateRestaurantTableSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "El código de la mesa es obligatorio")
      .max(30, "El código no puede superar 30 caracteres")
      .transform((value) => value.toUpperCase())
      .optional(),

    name: z
      .string()
      .trim()
      .min(1, "El nombre de la mesa es obligatorio")
      .max(80, "El nombre no puede superar 80 caracteres")
      .optional(),

    capacity: z
      .number()
      .int("La capacidad debe ser un número entero")
      .min(1, "La capacidad debe ser mayor que cero")
      .max(65535, "La capacidad no puede superar 65535")
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    {
      message: "Debes enviar al menos un campo para actualizar",
    },
  );

type UpdateRestaurantTableInput = z.infer<typeof updateRestaurantTableSchema>;

export { updateRestaurantTableSchema };
export type { UpdateRestaurantTableInput };
