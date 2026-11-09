import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const paymentTypeSchema = z.enum([
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "DIGITAL_WALLET",
  "VOUCHER",
  "STORE_CREDIT",
  "OTHER",
]);

const codeSchema = z
  .string()
  .trim()
  .min(1, "El código es obligatorio")
  .max(50, "El código no puede superar 50 caracteres")
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/,
        "El código solo admite letras, números y guiones bajos",
      ),
  );

const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio")
  .max(120, "El nombre no puede superar 120 caracteres");

const createPaymentMethodSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    paymentType: paymentTypeSchema,
    requiresReference: z.boolean().default(false),
    allowsChange: z.boolean().default(false),
    displayOrder: z.number().int().min(0).max(65535).default(0),
  })
  .superRefine((value, context) => {
    if (value.allowsChange && value.paymentType !== "CASH") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowsChange"],
        message: "Solamente los pagos en efectivo pueden devolver cambio",
      });
    }
  });

const updatePaymentMethodSchema = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    paymentType: paymentTypeSchema.optional(),
    requiresReference: z.boolean().optional(),
    allowsChange: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(65535).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debes enviar al menos un campo para actualizar",
  });

const updatePaymentMethodStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const paymentMethodIdParamsSchema = z
  .object({
    paymentMethodId: databaseIdSchema,
  })
  .strict();

const paymentMethodQuerySchema = z
  .object({
    activeOnly: z
      .enum(["true", "false"])
      .optional()
      .default("true")
      .transform((value) => value === "true"),
  })
  .strict();

type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
type UpdatePaymentMethodStatusInput = z.infer<
  typeof updatePaymentMethodStatusSchema
>;

export {
  createPaymentMethodSchema,
  paymentMethodIdParamsSchema,
  paymentMethodQuerySchema,
  updatePaymentMethodSchema,
  updatePaymentMethodStatusSchema,
};

export type {
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
  UpdatePaymentMethodStatusInput,
};
