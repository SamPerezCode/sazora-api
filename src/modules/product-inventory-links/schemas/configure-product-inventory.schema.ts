import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const nonNegativeQuantitySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/,
    "La cantidad debe ser positiva y tener máximo tres decimales",
  );

const positiveQuantitySchema = nonNegativeQuantitySchema.refine(
  (value) => Number(value) > 0,
  "La cantidad debe ser mayor que cero",
);

const nullableSkuSchema = z
  .string()
  .trim()
  .max(50)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const inventoryUnitSchema = z.enum([
  "UNIT",
  "GRAM",
  "KILOGRAM",
  "MILLILITER",
  "LITER",
  "PORTION",
  "PACKAGE",
]);

const configureProductInventoryParamsSchema = z
  .object({
    productId: databaseIdSchema,
  })
  .strict();

const configureProductInventorySchema = z
  .object({
    trackingType: z.enum(["RESALE", "PRODUCTION"]),

    sku: nullableSkuSchema,

    baseUnit: inventoryUnitSchema,

    openingQuantity: nonNegativeQuantitySchema.default("0.000"),

    minimumStock: nonNegativeQuantitySchema.default("0.000"),

    quantityPerProduct: positiveQuantitySchema.default("1.000"),
  })
  .strict();

type ConfigureProductInventoryInput = z.infer<
  typeof configureProductInventorySchema
>;

export {
  configureProductInventoryParamsSchema,
  configureProductInventorySchema,
};

export type { ConfigureProductInventoryInput };
