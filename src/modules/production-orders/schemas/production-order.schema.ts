import { z } from "zod";

const idSchema = z.coerce.number().int().positive().transform(String);

const quantitySchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,15}(?:\.\d{1,3})?$/,
    "Debe ser un decimal positivo con máximo 3 decimales",
  )
  .refine((value) => Number(value) > 0, {
    message: "Debe ser mayor que cero",
  });

const notesSchema = z
  .string()
  .trim()
  .max(1000)
  .nullable()
  .optional()
  .transform((value) =>
    value === undefined || value === null || value.length === 0 ? null : value,
  );

const plannedForSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : null));

const productionOrderStatusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

const productionOrderPayloadSchema = z.object({
  recipeId: idSchema,
  locationId: idSchema,
  batchQuantity: quantitySchema,
  plannedFor: plannedForSchema,
  notes: notesSchema,
});

const createProductionOrderSchema = productionOrderPayloadSchema;

const updateProductionOrderSchema = productionOrderPayloadSchema.extend({
  version: z.number().int().positive(),
});

const productionOrderParamsSchema = z.object({
  productionOrderId: idSchema,
});

const productionOrderListQuerySchema = z.object({
  locationId: idSchema.optional(),
  status: productionOrderStatusSchema.optional(),
});

const updateProductionOrderStatusSchema = z
  .object({
    status: z.enum(["PLANNED", "CANCELLED"]),

    cancellationReason: z
      .string()
      .trim()
      .min(3)
      .max(500)
      .nullable()
      .optional()
      .transform((value) => value ?? null),

    version: z.number().int().positive(),
  })
  .superRefine((data, context) => {
    if (data.status === "CANCELLED" && !data.cancellationReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cancellationReason"],
        message: "El motivo de cancelación es obligatorio",
      });
    }

    if (data.status === "PLANNED" && data.cancellationReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cancellationReason"],
        message: "Una orden planificada no lleva motivo de cancelación",
      });
    }
  });

const startProductionOrderSchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();

const productionOrderCompletionLineSchema = z
  .object({
    inventoryItemId: idSchema,
    quantity: quantitySchema,
  })
  .strict();

const completeProductionOrderSchema = z
  .object({
    version: z.number().int().positive(),

    inputs: z
      .array(productionOrderCompletionLineSchema)
      .min(1, "Debes registrar al menos un insumo consumido")
      .max(100),

    outputs: z
      .array(productionOrderCompletionLineSchema)
      .min(1, "Debes registrar al menos un producto obtenido")
      .max(100),
  })
  .strict()
  .superRefine((data, context) => {
    const inputIds = data.inputs.map((line) => line.inventoryItemId);

    if (new Set(inputIds).size !== inputIds.length) {
      context.addIssue({
        code: "custom",
        path: ["inputs"],
        message: "Un insumo no puede aparecer más de una vez",
      });
    }

    const outputIds = data.outputs.map((line) => line.inventoryItemId);

    if (new Set(outputIds).size !== outputIds.length) {
      context.addIssue({
        code: "custom",
        path: ["outputs"],
        message: "Un producto obtenido no puede aparecer más de una vez",
      });
    }

    const inputIdSet = new Set(inputIds);

    data.outputs.forEach((output, index) => {
      if (inputIdSet.has(output.inventoryItemId)) {
        context.addIssue({
          code: "custom",
          path: ["outputs", index, "inventoryItemId"],
          message:
            "Un artículo no puede ser insumo y producto obtenido en la misma orden",
        });
      }
    });
  });

type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>;

type UpdateProductionOrderInput = z.infer<typeof updateProductionOrderSchema>;

type UpdateProductionOrderStatusInput = z.infer<
  typeof updateProductionOrderStatusSchema
>;

type StartProductionOrderInput = z.infer<typeof startProductionOrderSchema>;

type CompleteProductionOrderInput = z.infer<
  typeof completeProductionOrderSchema
>;

export {
  completeProductionOrderSchema,
  createProductionOrderSchema,
  productionOrderListQuerySchema,
  productionOrderParamsSchema,
  startProductionOrderSchema,
  updateProductionOrderSchema,
  updateProductionOrderStatusSchema,
};

export type {
  CompleteProductionOrderInput,
  CreateProductionOrderInput,
  StartProductionOrderInput,
  UpdateProductionOrderInput,
  UpdateProductionOrderStatusInput,
};
