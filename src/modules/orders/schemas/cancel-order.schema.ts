import { z } from "zod";

const cancelOrderSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, "El motivo debe contener al menos 3 caracteres")
      .max(500, "El motivo no puede superar 500 caracteres"),
  })
  .strict();

type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export { cancelOrderSchema };
export type { CancelOrderInput };
