import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const cashAmountSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/,
    "El valor debe ser positivo y tener máximo dos decimales",
  );

const nullableNotesSchema = z
  .string()
  .trim()
  .max(500, "Las observaciones no pueden superar 500 caracteres")
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return value;
  });

const openCashSessionSchema = z
  .object({
    cashRegisterId: databaseIdSchema,
    openingCashAmount: cashAmountSchema,
    openingNotes: nullableNotesSchema,
  })
  .strict();

const cashSessionQuerySchema = z
  .object({
    locationId: databaseIdSchema.optional(),
    cashRegisterId: databaseIdSchema.optional(),
    status: z.enum(["OPEN", "CLOSED"]).optional(),
  })
  .strict();

const cashSessionIdParamsSchema = z
  .object({
    cashSessionId: databaseIdSchema,
  })
  .strict();

const closeCashSessionSchema = z
  .object({
    countedCashAmount: cashAmountSchema,
    closingNotes: nullableNotesSchema,
  })
  .strict();

type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
type CashSessionQuery = z.infer<typeof cashSessionQuerySchema>;

export {
  cashSessionIdParamsSchema,
  cashSessionQuerySchema,
  closeCashSessionSchema,
  openCashSessionSchema,
};

export type { CashSessionQuery, CloseCashSessionInput, OpenCashSessionInput };
