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

const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const productionLineSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
    quantity: positiveQuantitySchema,
    notes: optionalText,
  })
  .strict();

const productionIdParamsSchema = z
  .object({
    productionId: databaseIdSchema,
  })
  .strict();

const createProductionSchema = z
  .object({
    notes: optionalText,

    inputs: z
      .array(productionLineSchema)
      .min(1, "Debes registrar al menos un insumo consumido")
      .max(100),

    outputs: z
      .array(productionLineSchema)
      .min(1, "Debes registrar al menos un resultado producido")
      .max(100),
  })
  .strict()
  .superRefine((data, context) => {
    const inputIds = data.inputs.map((input) => input.inventoryItemId);

    if (new Set(inputIds).size !== inputIds.length) {
      context.addIssue({
        code: "custom",
        path: ["inputs"],
        message: "Un insumo no puede repetirse; suma su cantidad",
      });
    }

    const outputIds = data.outputs.map((output) => output.inventoryItemId);

    if (new Set(outputIds).size !== outputIds.length) {
      context.addIssue({
        code: "custom",
        path: ["outputs"],
        message: "Un resultado no puede repetirse; suma su cantidad",
      });
    }

    const inputIdSet = new Set(inputIds);

    data.outputs.forEach((output, index) => {
      if (inputIdSet.has(output.inventoryItemId)) {
        context.addIssue({
          code: "custom",
          path: ["outputs", index, "inventoryItemId"],
          message:
            "Un artículo no puede ser consumo y resultado en la misma producción",
        });
      }
    });
  });

export { createProductionSchema, productionIdParamsSchema };
