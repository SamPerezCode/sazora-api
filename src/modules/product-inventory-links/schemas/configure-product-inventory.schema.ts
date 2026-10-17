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

const nullableUnitCostSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/,
    "El costo debe tener máximo seis decimales",
  )
  .refine(
    (value) => Number(value) > 0,
    "El costo unitario debe ser mayor que cero",
  )
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const configureProductInventorySchema = z
  .object({
    trackingType: z.enum(["RESALE", "PRODUCTION"]),

    sku: nullableSkuSchema,

    baseUnit: inventoryUnitSchema,

    locationId: databaseIdSchema,

    openingQuantity: nonNegativeQuantitySchema.default("0.000"),

    openingUnitCost: nullableUnitCostSchema,

    minimumStock: nonNegativeQuantitySchema.default("0.000"),

    quantityPerProduct: positiveQuantitySchema.default("1.000"),
  })
  .strict()
  .superRefine((data, context) => {
    const hasOpeningStock = Number(data.openingQuantity) > 0;

    if (hasOpeningStock && data.openingUnitCost === null) {
      context.addIssue({
        code: "custom",
        path: ["openingUnitCost"],
        message: "Debes indicar el costo unitario de la existencia inicial",
      });
    }

    if (!hasOpeningStock && data.openingUnitCost !== null) {
      context.addIssue({
        code: "custom",
        path: ["openingUnitCost"],
        message: "No debes indicar un costo si la existencia inicial es cero",
      });
    }
  });

type ConfigureProductInventoryInput = z.infer<
  typeof configureProductInventorySchema
>;

export {
  configureProductInventoryParamsSchema,
  configureProductInventorySchema,
};

export type { ConfigureProductInventoryInput };
