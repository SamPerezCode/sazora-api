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

const productIdParamsSchema = z
  .object({
    productId: databaseIdSchema,
  })
  .strict();

const updateProductSchema = z
  .object({
    categoryId: databaseIdSchema.optional(),

    preparationAreaId: databaseIdSchema.optional(),

    fulfillmentMode: z.enum(["PREPARE_TO_ORDER", "READY_TO_SERVE"]).optional(),

    sku: z
      .string()
      .trim()
      .max(50, "El SKU no puede superar 50 caracteres")
      .nullable()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        return value && value.length > 0 ? value.toUpperCase() : null;
      }),

    name: z
      .string()
      .trim()
      .min(1, "El nombre del producto es obligatorio")
      .max(150, "El nombre no puede superar 150 caracteres")
      .optional(),

    description: z
      .string()
      .trim()
      .max(500, "La descripción no puede superar 500 caracteres")
      .nullable()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        return value && value.length > 0 ? value : null;
      }),

    currentPrice: moneySchema.optional(),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    {
      message: "Debes enviar al menos un campo para actualizar",
    },
  );

type UpdateProductInput = z.infer<typeof updateProductSchema>;

export { productIdParamsSchema, updateProductSchema };
export type { UpdateProductInput };
