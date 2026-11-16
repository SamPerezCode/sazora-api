import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

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

const refundOrderPaymentSchema = z
  .object({
    cashSessionId: databaseIdSchema.optional(),

    reason: z
      .string()
      .trim()
      .min(5, "El motivo debe contener al menos 5 caracteres")
      .max(500, "El motivo no puede superar 500 caracteres"),

    payments: z
      .array(
        z
          .object({
            orderPaymentId: databaseIdSchema,

            reference: nullableText(
              120,
              "La referencia no puede superar 120 caracteres",
            ),

            notes: nullableText(
              500,
              "Las observaciones no pueden superar 500 caracteres",
            ),
          })
          .strict(),
      )
      .min(1, "Debes devolver al menos un pago")
      .max(20, "No puedes devolver más de 20 pagos"),
  })
  .strict()
  .superRefine((input, context) => {
    const paymentIds = new Set<string>();

    input.payments.forEach((payment, index) => {
      if (paymentIds.has(payment.orderPaymentId)) {
        context.addIssue({
          code: "custom",
          path: ["payments", index, "orderPaymentId"],
          message: "No puedes repetir el mismo pago",
        });
      }

      paymentIds.add(payment.orderPaymentId);
    });
  });

type RefundOrderPaymentInput = z.infer<typeof refundOrderPaymentSchema>;

export { refundOrderPaymentSchema };

export type { RefundOrderPaymentInput };
