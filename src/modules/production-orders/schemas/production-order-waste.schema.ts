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
  .refine((value) => Number(value) > 0, "La cantidad debe ser mayor que cero");

const optionalNotesSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) =>
    value === undefined || value === null || value.length === 0 ? null : value,
  );

const productionOrderWasteLineSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
    quantity: positiveQuantitySchema,
    notes: optionalNotesSchema,
  })
  .strict();

const createProductionOrderWasteSchema = z
  .object({
    /*
     * Versión actual de la orden.
     *
     * Al registrar el desperdicio se incrementará para evitar
     * que una finalización simultánea use información anterior.
     */
    version: z.number().int().positive(),

    reason: z
      .string()
      .trim()
      .min(3, "Debes explicar el motivo del desperdicio")
      .max(500),

    lines: z
      .array(productionOrderWasteLineSchema)
      .min(1, "Debes registrar al menos un artículo desperdiciado")
      .max(100, "No puedes registrar más de 100 artículos"),
  })
  .strict()
  .superRefine((data, context) => {
    const inventoryItemIds = data.lines.map((line) => line.inventoryItemId);

    if (new Set(inventoryItemIds).size !== inventoryItemIds.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message:
          "Un artículo no puede repetirse; suma su cantidad en una sola línea",
      });
    }
  });

type CreateProductionOrderWasteInput = z.infer<
  typeof createProductionOrderWasteSchema
>;

export { createProductionOrderWasteSchema };

export type { CreateProductionOrderWasteInput };
