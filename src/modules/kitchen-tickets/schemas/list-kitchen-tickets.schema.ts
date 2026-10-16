import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const listKitchenTicketsQuerySchema = z
  .object({
    locationId: databaseIdSchema.optional(),
    preparationAreaId: databaseIdSchema.optional(),
  })
  .strict();

type ListKitchenTicketsQuery = z.infer<typeof listKitchenTicketsQuerySchema>;

export { listKitchenTicketsQuerySchema };
export type { ListKitchenTicketsQuery };
