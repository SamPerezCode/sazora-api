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

const allocationPercentageSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/,
    "El porcentaje debe tener máximo seis decimales",
  )
  .refine(
    (value) => Number(value) > 0 && Number(value) <= 100,
    "El porcentaje debe ser mayor que cero y máximo 100",
  )
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const productionInputSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
    quantity: positiveQuantitySchema,
    notes: optionalText,
  })
  .strict();

const productionOutputSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
    quantity: positiveQuantitySchema,
    costAllocationPercentage: allocationPercentageSchema,
    notes: optionalText,
  })
  .strict();

const percentageToMillionths = (value: string): bigint => {
  const [whole = "0", fraction = ""] = value.split(".");

  return (
    BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6))
  );
};

const productionListQuerySchema = z
  .object({
    locationId: databaseIdSchema.optional(),
  })
  .strict();

const productionIdParamsSchema = z
  .object({
    productionId: databaseIdSchema,
  })
  .strict();

const createProductionSchema = z
  .object({
    locationId: databaseIdSchema,

    notes: optionalText,

    inputs: z
      .array(productionInputSchema)
      .min(1, "Debes registrar al menos un insumo consumido")
      .max(100),

    outputs: z
      .array(productionOutputSchema)
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

    if (data.outputs.length === 1) {
      const percentage = data.outputs[0]?.costAllocationPercentage;

      if (
        percentage !== null &&
        percentage !== undefined &&
        percentageToMillionths(percentage) !== 100_000_000n
      ) {
        context.addIssue({
          code: "custom",
          path: ["outputs", 0, "costAllocationPercentage"],
          message: "El único resultado debe recibir el 100 % del costo",
        });
      }

      return;
    }

    const hasMissingPercentage = data.outputs.some(
      (output) => output.costAllocationPercentage === null,
    );

    if (hasMissingPercentage) {
      context.addIssue({
        code: "custom",
        path: ["outputs"],
        message: "Debes indicar el porcentaje de costo de cada resultado",
      });

      return;
    }

    const totalPercentage = data.outputs.reduce(
      (total, output) =>
        total + percentageToMillionths(output.costAllocationPercentage ?? "0"),
      0n,
    );

    if (totalPercentage !== 100_000_000n) {
      context.addIssue({
        code: "custom",
        path: ["outputs"],
        message: "La distribución del costo debe sumar exactamente 100 %",
      });
    }
  });

export {
  createProductionSchema,
  productionIdParamsSchema,
  productionListQuerySchema,
};
