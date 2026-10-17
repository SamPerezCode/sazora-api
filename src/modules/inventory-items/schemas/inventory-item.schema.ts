import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const quantitySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/,
    "La cantidad debe ser positiva y tener máximo tres decimales",
  );

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

const nullableSkuSchema = z
  .string()
  .trim()
  .max(50)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const inventoryItemTypeSchema = z.enum([
  "RAW_MATERIAL",
  "SEMI_FINISHED",
  "FINISHED_GOOD",
  "RESALE_GOOD",
]);

const inventoryUnitSchema = z.enum([
  "UNIT",
  "GRAM",
  "KILOGRAM",
  "MILLILITER",
  "LITER",
  "PORTION",
  "PACKAGE",
]);

const inventoryItemIdParamsSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
  })
  .strict();

const createInventoryItemSchema = z
  .object({
    sku: nullableSkuSchema,

    name: z.string().trim().min(1, "El nombre es obligatorio").max(150),

    itemType: inventoryItemTypeSchema,

    baseUnit: inventoryUnitSchema,

    locationId: databaseIdSchema,

    openingQuantity: quantitySchema.default("0.000"),

    openingUnitCost: nullableUnitCostSchema,

    minimumStock: quantitySchema.default("0.000"),
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

const updateInventoryItemSchema = z
  .object({
    sku: nullableSkuSchema,

    name: z.string().trim().min(1).max(150).optional(),

    itemType: inventoryItemTypeSchema.optional(),

    baseUnit: inventoryUnitSchema.optional(),

    minimumStock: quantitySchema.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Debes enviar al menos un campo",
  );

const updateInventoryItemStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export {
  createInventoryItemSchema,
  inventoryItemIdParamsSchema,
  updateInventoryItemSchema,
  updateInventoryItemStatusSchema,
};
