import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const cashRegisterCodeSchema = z
  .string()
  .trim()
  .min(1, "El código es obligatorio")
  .max(30, "El código no puede superar 30 caracteres")
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
        "El código solo admite letras, números y guiones",
      ),
  );

const createCashRegisterSchema = z
  .object({
    locationId: databaseIdSchema,

    code: cashRegisterCodeSchema,

    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(120, "El nombre no puede superar 120 caracteres"),
  })
  .strict();

const cashRegisterQuerySchema = z
  .object({
    locationId: databaseIdSchema.optional(),

    activeOnly: z
      .enum(["true", "false"])
      .optional()
      .default("true")
      .transform((value) => value === "true"),
  })
  .strict();

type CreateCashRegisterInput = z.infer<typeof createCashRegisterSchema>;
type CashRegisterQuery = z.infer<typeof cashRegisterQuerySchema>;

export { cashRegisterQuerySchema, createCashRegisterSchema };

export type { CashRegisterQuery, CreateCashRegisterInput };
