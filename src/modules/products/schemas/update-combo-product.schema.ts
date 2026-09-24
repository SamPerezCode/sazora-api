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
    "El precio debe tener máximo dos decimales",
  );

const comboComponentSchema = z
  .object({
    productId: databaseIdSchema,

    quantity: z.coerce
      .number()
      .int("La cantidad debe ser un entero")
      .positive("La cantidad debe ser mayor que cero")
      .max(10000),
  })
  .strict();

const parseComponents = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const comboProductIdParamsSchema = z
  .object({
    comboProductId: databaseIdSchema,
  })
  .strict();

const updateComboProductSchema = z
  .object({
    categoryId: databaseIdSchema.optional(),

    preparationAreaId: databaseIdSchema.optional(),

    fulfillmentMode: z.enum(["PREPARE_TO_ORDER", "READY_TO_SERVE"]).optional(),

    sku: z
      .string()
      .trim()
      .max(50)
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
      .min(1, "El nombre es obligatorio")
      .max(150)
      .optional(),

    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        return value && value.length > 0 ? value : null;
      }),

    currentPrice: moneySchema.optional(),

    components: z
      .preprocess(
        parseComponents,
        z
          .array(comboComponentSchema)
          .min(2, "Un combo debe tener al menos dos productos")
          .max(100)
          .superRefine((components, context) => {
            const productIds = components.map(
              (component) => component.productId,
            );

            if (new Set(productIds).size !== productIds.length) {
              context.addIssue({
                code: "custom",
                message: "Un producto no puede repetirse dentro del combo",
              });
            }
          }),
      )
      .optional(),
  })
  .strict();

type UpdateComboProductInput = z.infer<typeof updateComboProductSchema>;

export { comboProductIdParamsSchema, updateComboProductSchema };

export type { UpdateComboProductInput };
