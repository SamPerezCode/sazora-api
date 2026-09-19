import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const moneySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    "El precio debe ser un valor válido con máximo dos decimales",
  );

const createProductSchema = z
  .object({
    categoryId: databaseIdSchema,

    preparationAreaId: databaseIdSchema,

    sku: z
      .string()
      .trim()
      .max(50, "El SKU no puede superar 50 caracteres")
      .nullable()
      .optional()
      .transform((value) =>
        value && value.length > 0 ? value.toUpperCase() : null,
      ),

    name: z
      .string()
      .trim()
      .min(1, "El nombre del producto es obligatorio")
      .max(150, "El nombre no puede superar 150 caracteres"),

    description: z
      .string()
      .trim()
      .max(500, "La descripción no puede superar 500 caracteres")
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    currentPrice: moneySchema,
  })
  .strict();

type CreateProductInput = z.infer<typeof createProductSchema>;

export { createProductSchema };
export type { CreateProductInput };
