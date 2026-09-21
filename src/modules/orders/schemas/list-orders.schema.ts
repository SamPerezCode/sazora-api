import { z } from "zod";

const listOrdersQuerySchema = z
  .object({
    status: z
      .enum(["OPEN", "CONFIRMED", "DELIVERED", "CLOSED", "CANCELLED"])
      .optional(),

    serviceType: z.enum(["TABLE", "TAKEAWAY", "DELIVERY"]).optional(),

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

type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export { listOrdersQuerySchema };
export type { ListOrdersQuery };
