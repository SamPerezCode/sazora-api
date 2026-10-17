import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const positiveQuantitySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/,
    "La cantidad debe tener máximo tres decimales",
  )
  .refine((value) => Number(value) > 0, {
    message: "La cantidad debe ser mayor que cero",
  });

const positiveCostSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/,
    "El costo debe tener máximo seis decimales",
  )
  .refine((value) => Number(value) > 0, {
    message: "El costo debe ser mayor que cero",
  });

const conversionFactorSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/,
    "El factor debe tener máximo seis decimales",
  )
  .refine((value) => Number(value) > 0, {
    message: "El factor de conversión debe ser mayor que cero",
  });

const optionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalReferenceSchema = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const inventoryItemParamsSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
  })
  .strict();

const createPurchasePresentationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    conversionFactor: conversionFactorSchema,
  })
  .strict();

const createInventoryPurchaseSchema = z
  .object({
    locationId: databaseIdSchema,
    externalReference: optionalReferenceSchema,
    notes: optionalTextSchema,

    lines: z
      .array(
        z
          .object({
            inventoryItemId: databaseIdSchema,
            presentationId: databaseIdSchema,
            purchasedQuantity: positiveQuantitySchema,
            totalCost: positiveCostSchema,
            notes: optionalTextSchema,
          })
          .strict(),
      )
      .min(1, "La compra requiere al menos una línea")
      .max(100, "La compra no puede superar 100 líneas"),
  })
  .strict()
  .superRefine((data, context) => {
    const itemIds = data.lines.map((line) => line.inventoryItemId);

    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Un artículo no puede repetirse dentro de la misma compra",
      });
    }
  });

export {
  createInventoryPurchaseSchema,
  createPurchasePresentationSchema,
  inventoryItemParamsSchema,
};
