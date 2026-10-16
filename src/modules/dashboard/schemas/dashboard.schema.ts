import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const dashboardQuerySchema = z
  .object({
    locationId: databaseIdSchema.optional(),
  })
  .strict();

type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export { dashboardQuerySchema };
export type { DashboardQuery };
