import { z } from "zod";

const listKitchenTicketsQuerySchema = z
  .object({
    preparationAreaId: z
      .string()
      .trim()
      .regex(
        /^[1-9]\d*$/,
        "El identificador del área debe ser un entero positivo",
      )
      .optional(),
  })
  .strict();

type ListKitchenTicketsQuery = z.infer<typeof listKitchenTicketsQuerySchema>;

export { listKitchenTicketsQuerySchema };
export type { ListKitchenTicketsQuery };
