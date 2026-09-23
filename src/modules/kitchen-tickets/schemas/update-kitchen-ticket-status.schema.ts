import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const updateKitchenTicketStatusParamsSchema = z
  .object({
    kitchenTicketId: databaseIdSchema,
  })
  .strict();

const updateKitchenTicketStatusSchema = z
  .object({
    status: z.enum(["IN_PREPARATION", "READY", "DELIVERED"]),
  })
  .strict();

type UpdateKitchenTicketStatusInput = z.infer<
  typeof updateKitchenTicketStatusSchema
>;

export {
  updateKitchenTicketStatusParamsSchema,
  updateKitchenTicketStatusSchema,
};

export type { UpdateKitchenTicketStatusInput };
