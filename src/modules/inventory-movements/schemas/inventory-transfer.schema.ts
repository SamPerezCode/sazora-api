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

const createInventoryTransferSchema = z
  .object({
    sourceLocationId: databaseIdSchema,
    destinationLocationId: databaseIdSchema,

    externalReference: optionalReferenceSchema,

    notes: z
      .string()
      .trim()
      .min(3, "El motivo debe contener al menos tres caracteres")
      .max(500),

    lines: z
      .array(
        z
          .object({
            inventoryItemId: databaseIdSchema,
            quantity: positiveQuantitySchema,
            notes: optionalTextSchema,
          })
          .strict(),
      )
      .min(1, "La transferencia requiere al menos una línea")
      .max(100, "La transferencia no puede superar 100 líneas"),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.sourceLocationId === data.destinationLocationId) {
      context.addIssue({
        code: "custom",
        path: ["destinationLocationId"],
        message: "La ubicación de destino debe ser diferente al origen",
      });
    }

    const itemIds = data.lines.map((line) => line.inventoryItemId);

    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Un artículo no puede repetirse en la transferencia",
      });
    }
  });

export { createInventoryTransferSchema };
