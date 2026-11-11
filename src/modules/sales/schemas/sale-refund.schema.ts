import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const moneySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/,
    "El valor debe ser mayor que cero y tener máximo dos decimales",
  );

const nullableText = (maximum: number, message: string) =>
  z
    .string()
    .trim()
    .max(maximum, message)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }

      return value;
    });

const saleRefundItemSchema = z
  .object({
    saleItemId: databaseIdSchema,

    quantity: z
      .number()
      .int("La cantidad debe ser un número entero")
      .positive("La cantidad debe ser mayor que cero")
      .max(65535, "La cantidad supera el máximo permitido"),

    restoreInventory: z.boolean().optional().default(false),
  })
  .strict();

const saleRefundPaymentSchema = z
  .object({
    salePaymentId: databaseIdSchema,
    amount: moneySchema,

    reference: nullableText(
      120,
      "La referencia no puede superar 120 caracteres",
    ),

    notes: nullableText(
      500,
      "Las observaciones no pueden superar 500 caracteres",
    ),
  })
  .strict();

const createSaleRefundSchema = z
  .object({
    cashSessionId: databaseIdSchema,

    reason: z
      .string()
      .trim()
      .min(5, "El motivo debe tener al menos 5 caracteres")
      .max(500, "El motivo no puede superar 500 caracteres"),

    items: z
      .array(saleRefundItemSchema)
      .min(1, "Debes devolver al menos un producto")
      .max(100, "No puedes devolver más de 100 productos a la vez"),

    payments: z
      .array(saleRefundPaymentSchema)
      .min(1, "Debes registrar al menos un medio de reembolso")
      .max(20, "No puedes registrar más de 20 medios de reembolso"),
  })
  .strict()
  .superRefine((input, context) => {
    const saleItemIds = new Set<string>();

    input.items.forEach((item, index) => {
      if (saleItemIds.has(item.saleItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "saleItemId"],
          message: "No puedes repetir un producto en la misma devolución",
        });
      }

      saleItemIds.add(item.saleItemId);
    });

    const salePaymentIds = new Set<string>();

    input.payments.forEach((payment, index) => {
      if (salePaymentIds.has(payment.salePaymentId)) {
        context.addIssue({
          code: "custom",
          path: ["payments", index, "salePaymentId"],
          message: "No puedes repetir el mismo pago en una devolución",
        });
      }

      salePaymentIds.add(payment.salePaymentId);
    });
  });

const saleRefundIdParamsSchema = z
  .object({
    saleId: databaseIdSchema,
    refundId: databaseIdSchema,
  })
  .strict();

const saleRefundListParamsSchema = z
  .object({
    saleId: databaseIdSchema,
  })
  .strict();

type CreateSaleRefundInput = z.infer<typeof createSaleRefundSchema>;

export {
  createSaleRefundSchema,
  saleRefundIdParamsSchema,
  saleRefundListParamsSchema,
};

export type { CreateSaleRefundInput };
