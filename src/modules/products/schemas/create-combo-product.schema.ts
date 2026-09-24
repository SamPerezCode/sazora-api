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

const componentSchema = z
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

const createComboProductSchema = z
  .object({
    categoryId: databaseIdSchema,

    preparationAreaId: databaseIdSchema,

    fulfillmentMode: z.enum(["PREPARE_TO_ORDER", "READY_TO_SERVE"]),

    sku: z
      .string()
      .trim()
      .max(50)
      .nullable()
      .optional()
      .transform((value) =>
        value && value.length > 0 ? value.toUpperCase() : null,
      ),

    name: z.string().trim().min(1, "El nombre es obligatorio").max(150),

    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    currentPrice: moneySchema,

    components: z.preprocess(
      parseComponents,
      z
        .array(componentSchema)
        .min(2, "Un combo debe tener al menos dos productos")
        .max(100),
    ),
  })
  .strict()
  .superRefine((data, context) => {
    const productIds = data.components.map((component) => component.productId);

    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({
        code: "custom",
        path: ["components"],
        message: "Un producto no puede repetirse dentro del combo",
      });
    }
  });

type CreateComboProductInput = z.infer<typeof createComboProductSchema>;

export { createComboProductSchema };
export type { CreateComboProductInput };
