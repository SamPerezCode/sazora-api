import { z } from "zod";

const createCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre de la categoría es obligatorio")
      .max(100, "El nombre de la categoría no puede superar 100 caracteres"),

    description: z
      .string()
      .trim()
      .max(255, "La descripción no puede superar 255 caracteres")
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    displayOrder: z
      .number()
      .int("El orden debe ser un número entero")
      .min(0, "El orden no puede ser negativo")
      .max(65535, "El orden no puede superar 65535")
      .default(0),
  })
  .strict();

type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export { createCategorySchema };
export type { CreateCategoryInput };
