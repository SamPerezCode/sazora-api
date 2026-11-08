import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "El identificador debe ser numérico");

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
        /^[A-Z0-9][A-Z0-9_-]*$/,
        "El código solo puede contener letras, números, guiones y guiones bajos",
      ),
  );

const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio")
  .max(120, "El nombre no puede superar 120 caracteres");

const descriptionValueSchema = z
  .string()
  .trim()
  .max(500, "La descripción no puede superar 500 caracteres")
  .nullable()
  .transform((value) => {
    if (value === null || value === "") {
      return null;
    }

    return value;
  });

const createDescriptionSchema = descriptionValueSchema.optional().default(null);

const updateDescriptionSchema = descriptionValueSchema.optional();

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar el formato YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "La fecha no es válida");

const percentageSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/,
    "La tarifa debe tener hasta cuatro decimales",
  )
  .refine((value) => Number(value) <= 100, {
    message: "La tarifa no puede superar el 100%",
  });

const taxRateInputSchema = z
  .object({
    rate: percentageSchema,
    validFrom: isoDateSchema,
    validTo: isoDateSchema.nullable().optional().default(null),
  })
  .superRefine((value, context) => {
    if (value.validTo !== null && value.validTo < value.validFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validTo"],
        message: "La fecha final no puede ser anterior a la fecha inicial",
      });
    }
  });

export const taxClassIdParamsSchema = z.object({
  taxClassId: databaseIdSchema,
});

export const createTaxClassSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    taxType: z.enum([
      "VAT",
      "CONSUMPTION",
      "EXEMPT",
      "EXCLUDED",
      "NON_TAXED",
      "OTHER",
    ]),
    description: createDescriptionSchema,
    initialRate: taxRateInputSchema,
  })
  .superRefine((value, context) => {
    const rate = Number(value.initialRate.rate);

    const zeroRateTypes = new Set(["EXEMPT", "EXCLUDED", "NON_TAXED"]);

    if (zeroRateTypes.has(value.taxType) && rate !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["initialRate", "rate"],
        message:
          "Las clases exentas, excluidas o no gravadas deben tener tarifa 0",
      });
    }

    if (
      (value.taxType === "VAT" || value.taxType === "CONSUMPTION") &&
      rate <= 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["initialRate", "rate"],
        message:
          "Los impuestos de IVA o consumo deben tener una tarifa mayor que 0",
      });
    }
  });

export const updateTaxClassSchema = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    description: updateDescriptionSchema,
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.description !== undefined,
    {
      message: "Debes enviar al menos un campo para actualizar",
    },
  );

export const updateTaxClassStatusSchema = z.object({
  isActive: z.boolean(),
});

export const createTaxRateSchema = taxRateInputSchema;

export type CreateTaxClassInput = z.infer<typeof createTaxClassSchema>;

export type UpdateTaxClassInput = z.infer<typeof updateTaxClassSchema>;

export type UpdateTaxClassStatusInput = z.infer<
  typeof updateTaxClassStatusSchema
>;

export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>;
