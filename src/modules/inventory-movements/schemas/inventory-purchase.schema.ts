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

const nonNegativeMoneySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/,
    "El valor debe tener máximo seis decimales",
  );

const positiveMoneySchema = nonNegativeMoneySchema.refine(
  (value) => Number(value) > 0,
  {
    message: "El valor debe ser mayor que cero",
  },
);

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

const optionalShortTextSchema = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar el formato YYYY-MM-DD")
  .nullable()
  .optional()
  .transform((value) => value ?? null);

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

    supplierName: optionalShortTextSchema(160),
    supplierDocument: optionalShortTextSchema(80),

    externalReference: optionalShortTextSchema(120),
    documentDate: optionalDateSchema,

    notes: optionalTextSchema,

    lines: z
      .array(
        z
          .object({
            inventoryItemId: databaseIdSchema,
            presentationId: databaseIdSchema,
            purchasedQuantity: positiveQuantitySchema,

            grossCost: positiveMoneySchema,

            discountAmount: nonNegativeMoneySchema.optional().default("0"),

            additionalCostAmount: nonNegativeMoneySchema
              .optional()
              .default("0"),

            notes: optionalTextSchema,
          })
          .strict()
          .superRefine((line, context) => {
            const grossCost = Number(line.grossCost);
            const discount = Number(line.discountAmount);
            const additionalCost = Number(line.additionalCostAmount);

            if (discount > grossCost) {
              context.addIssue({
                code: "custom",
                path: ["discountAmount"],
                message: "El descuento no puede superar el costo bruto",
              });
            }

            if (grossCost - discount + additionalCost <= 0) {
              context.addIssue({
                code: "custom",
                path: ["grossCost"],
                message: "El costo neto de la línea debe ser mayor que cero",
              });
            }
          }),
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

    if (data.supplierDocument && !data.supplierName) {
      context.addIssue({
        code: "custom",
        path: ["supplierName"],
        message:
          "Debes indicar el nombre cuando registras el documento del proveedor",
      });
    }
  });

export {
  createInventoryPurchaseSchema,
  createPurchasePresentationSchema,
  inventoryItemParamsSchema,
};
