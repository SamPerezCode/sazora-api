import { z } from "zod";

const categoryIdParamsSchema = z
  .object({
    categoryId: z
      .string()
      .regex(/^[1-9]\d*$/, "El identificador de la categoría no es válido"),
  })
  .strict();

const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre de la categoría no puede estar vacío")
      .max(100, "El nombre no puede superar 100 caracteres")
      .optional(),

    description: z
      .string()
      .trim()
      .max(255, "La descripción no puede superar 255 caracteres")
      .nullable()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        return value && value.length > 0 ? value : null;
      }),

    displayOrder: z
      .number()
      .int("El orden debe ser un número entero")
      .min(0, "El orden no puede ser negativo")
      .max(65535, "El orden no puede superar 65535")
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.displayOrder !== undefined,
    {
      message: "Debe enviar al menos un campo para actualizar",
    },
  );

type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>;

type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export { categoryIdParamsSchema, updateCategorySchema };

export type { CategoryIdParams, UpdateCategoryInput };
