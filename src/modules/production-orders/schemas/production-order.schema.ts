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

type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>;

type UpdateProductionOrderInput = z.infer<typeof updateProductionOrderSchema>;

type UpdateProductionOrderStatusInput = z.infer<
  typeof updateProductionOrderStatusSchema
>;

type StartProductionOrderInput = z.infer<typeof startProductionOrderSchema>;

export {
  createProductionOrderSchema,
  productionOrderListQuerySchema,
  productionOrderParamsSchema,
  startProductionOrderSchema,
  updateProductionOrderSchema,
  updateProductionOrderStatusSchema,
};

export type {
  CreateProductionOrderInput,
  StartProductionOrderInput,
  UpdateProductionOrderInput,
  UpdateProductionOrderStatusInput,
};
