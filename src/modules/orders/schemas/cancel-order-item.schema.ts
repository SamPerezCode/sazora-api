import { z } from "zod";

const cancelOrderItemSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, "El motivo debe contener al menos 3 caracteres")
      .max(500, "El motivo no puede superar 500 caracteres"),
  })
  .strict();

type CancelOrderItemInput = z.infer<typeof cancelOrderItemSchema>;

export { cancelOrderItemSchema };
export type { CancelOrderItemInput };
