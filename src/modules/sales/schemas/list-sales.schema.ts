import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const dateTimeSchema = z.string().trim().datetime({
  offset: true,
  message: "La fecha debe incluir hora y zona horaria",
});

const listSalesQuerySchema = z
  .object({
    locationId: databaseIdSchema.optional(),
    cashSessionId: databaseIdSchema.optional(),

    status: z
      .enum(["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "VOIDED"])
      .optional(),

    from: dateTimeSchema.optional(),
    to: dateTimeSchema.optional(),

    page: z.coerce
      .number()
      .int("La página debe ser un número entero")
      .min(1, "La página debe ser mayor que cero")
      .default(1),

    pageSize: z.coerce
      .number()
      .int("El tamaño de página debe ser un número entero")
      .min(1, "El tamaño de página debe ser mayor que cero")
      .max(100, "El tamaño de página no puede superar 100")
      .default(20),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.from && input.to && input.from > input.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "La fecha final no puede ser anterior a la inicial",
      });
    }
  });

type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;

export { listSalesQuerySchema };
export type { ListSalesQuery };
