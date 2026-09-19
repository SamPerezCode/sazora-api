import { z } from "zod";

const createRestaurantTableSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "El código de la mesa es obligatorio")
      .max(30, "El código no puede superar 30 caracteres")
      .transform((value) => value.toUpperCase()),

    name: z
      .string()
      .trim()
      .min(1, "El nombre de la mesa es obligatorio")
      .max(80, "El nombre no puede superar 80 caracteres"),

    capacity: z
      .number()
      .int("La capacidad debe ser un número entero")
      .min(1, "La capacidad debe ser mayor que cero")
      .max(65535, "La capacidad no puede superar 65535")
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .strict();

type CreateRestaurantTableInput = z.infer<typeof createRestaurantTableSchema>;

export { createRestaurantTableSchema };
export type { CreateRestaurantTableInput };
