import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const commercialCustomerIdParamsSchema = z
  .object({
    customerId: databaseIdSchema,
  })
  .strict();

const commercialCustomerHistoryQuerySchema = z
  .object({
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
  .strict();

const listCommercialCustomersQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(100, "La búsqueda no puede superar 100 caracteres")
      .optional()
      .transform((value) =>
        value === undefined || value.length === 0 ? undefined : value,
      ),

    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        return value === "true";
      }),

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
  .strict();

type CommercialCustomerHistoryQuery = z.infer<
  typeof commercialCustomerHistoryQuerySchema
>;

type ListCommercialCustomersQuery = z.infer<
  typeof listCommercialCustomersQuerySchema
>;

export {
  commercialCustomerHistoryQuerySchema,
  commercialCustomerIdParamsSchema,
  listCommercialCustomersQuerySchema,
};

export type { CommercialCustomerHistoryQuery, ListCommercialCustomersQuery };
