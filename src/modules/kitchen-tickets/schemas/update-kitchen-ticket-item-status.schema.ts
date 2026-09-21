import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const kitchenTicketItemParamsSchema = z
  .object({
    kitchenTicketId: databaseIdSchema,
    kitchenTicketItemId: databaseIdSchema,
  })
  .strict();

const updateKitchenTicketItemStatusSchema = z
  .object({
    status: z.enum(["IN_PREPARATION", "READY", "DELIVERED"]),
  })
  .strict();

type UpdateKitchenTicketItemStatusInput = z.infer<
  typeof updateKitchenTicketItemStatusSchema
>;

export { kitchenTicketItemParamsSchema, updateKitchenTicketItemStatusSchema };

export type { UpdateKitchenTicketItemStatusInput };
