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

const salePaymentSchema = z
  .object({
    paymentMethodId: databaseIdSchema,
    amount: moneySchema,
    tenderedAmount: moneySchema.optional(),
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

const createSaleSchema = z
  .object({
    orderId: databaseIdSchema,
    cashSessionId: databaseIdSchema,

    commercialCustomerId: databaseIdSchema.nullable().optional().default(null),

    payments: z
      .array(salePaymentSchema)
      .min(1, "Debes registrar al menos una forma de pago")
      .max(20, "No puedes registrar más de 20 pagos"),
  })
  .strict();

type CreateSaleInput = z.infer<typeof createSaleSchema>;
type SalePaymentInput = z.infer<typeof salePaymentSchema>;

export { createSaleSchema };

export type { CreateSaleInput, SalePaymentInput };
