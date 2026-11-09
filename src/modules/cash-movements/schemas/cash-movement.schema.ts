import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const amountSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/,
    "El valor debe ser mayor que cero y tener máximo dos decimales",
  );

const referenceSchema = z
  .string()
  .trim()
  .max(120, "La referencia no puede superar 120 caracteres")
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return value;
  });

const createManualCashMovementSchema = z
  .object({
    cashSessionId: databaseIdSchema,

    movementType: z.enum(["MANUAL_INCOME", "WITHDRAWAL", "EXPENSE"]),

    amount: amountSchema,

    reason: z
      .string()
      .trim()
      .min(1, "La razón es obligatoria")
      .max(500, "La razón no puede superar 500 caracteres"),

    reference: referenceSchema,
  })
  .strict();

const cashMovementQuerySchema = z
  .object({
    cashSessionId: databaseIdSchema,
  })
  .strict();

type CreateManualCashMovementInput = z.infer<
  typeof createManualCashMovementSchema
>;

type CashMovementQuery = z.infer<typeof cashMovementQuerySchema>;

export { cashMovementQuerySchema, createManualCashMovementSchema };

export type { CashMovementQuery, CreateManualCashMovementInput };
