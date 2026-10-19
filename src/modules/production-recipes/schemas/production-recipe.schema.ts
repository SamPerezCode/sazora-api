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

const nullableNotesSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const recipeInputSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
    quantity: positiveQuantitySchema,
    notes: nullableNotesSchema,
  })
  .strict();

const recipeOutputSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
    quantity: positiveQuantitySchema,
    costAllocationPercentage: allocationPercentageSchema,
    notes: nullableNotesSchema,
  })
  .strict();

const percentageToMillionths = (value: string): bigint => {
  const [whole = "0", fraction = ""] = value.split(".");

  return (
    BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6))
  );
};

const validateRecipeComposition = (
  data: {
    inputs: readonly {
      inventoryItemId: string;
    }[];

    outputs: readonly {
      inventoryItemId: string;
      costAllocationPercentage: string | null;
    }[];
  },
  context: z.RefinementCtx,
) => {
  const inputIds = data.inputs.map((input) => input.inventoryItemId);

  if (new Set(inputIds).size !== inputIds.length) {
    context.addIssue({
      code: "custom",
      path: ["inputs"],
      message: "Un insumo no puede repetirse en la receta",
    });
  }

  const outputIds = data.outputs.map((output) => output.inventoryItemId);

  if (new Set(outputIds).size !== outputIds.length) {
    context.addIssue({
      code: "custom",
      path: ["outputs"],
      message: "Un resultado no puede repetirse en la receta",
    });
  }

  const inputIdSet = new Set(inputIds);

  data.outputs.forEach((output, index) => {
    if (inputIdSet.has(output.inventoryItemId)) {
      context.addIssue({
        code: "custom",
        path: ["outputs", index, "inventoryItemId"],
        message:
          "Un artículo no puede ser insumo y resultado en la misma receta",
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

  const total = data.outputs.reduce(
    (sum, output) =>
      sum + percentageToMillionths(output.costAllocationPercentage ?? "0"),
    0n,
  );

  if (total !== 100_000_000n) {
    context.addIssue({
      code: "custom",
      path: ["outputs"],
      message: "La distribución del costo debe sumar exactamente 100 %",
    });
  }
};

const productionRecipePayloadSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "El código es obligatorio")
      .max(50)
      .regex(
        /^[A-Za-z0-9._-]+$/,
        "El código solo permite letras, números, punto, guion y guion bajo",
      ),

    name: z.string().trim().min(1, "El nombre es obligatorio").max(150),

    notes: nullableNotesSchema,

    inputs: z
      .array(recipeInputSchema)
      .min(1, "La receta requiere al menos un insumo")
      .max(100),

    outputs: z
      .array(recipeOutputSchema)
      .min(1, "La receta requiere al menos un resultado")
      .max(100),
  })
  .strict()
  .superRefine(validateRecipeComposition);

const createProductionRecipeSchema = productionRecipePayloadSchema;

const updateProductionRecipeSchema = productionRecipePayloadSchema;

const productionRecipeIdParamsSchema = z
  .object({
    productionRecipeId: databaseIdSchema,
  })
  .strict();

const updateProductionRecipeStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

type CreateProductionRecipeInput = z.infer<typeof createProductionRecipeSchema>;

type UpdateProductionRecipeInput = z.infer<typeof updateProductionRecipeSchema>;

export {
  createProductionRecipeSchema,
  productionRecipeIdParamsSchema,
  updateProductionRecipeSchema,
  updateProductionRecipeStatusSchema,
};

export type { CreateProductionRecipeInput, UpdateProductionRecipeInput };
