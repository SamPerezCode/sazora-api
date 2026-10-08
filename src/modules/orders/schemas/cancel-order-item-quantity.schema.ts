import { z } from "zod";

const cancelOrderItemQuantitySchema = z
  .object({
    quantity: z
      .number()
      .int("La cantidad debe ser un número entero")
      .min(1, "Debes cancelar al menos una unidad")
      .max(65534, "La cantidad cancelada es demasiado grande"),

    reason: z
      .string()
      .trim()
      .min(3, "El motivo debe contener al menos 3 caracteres")
      .max(500, "El motivo no puede superar 500 caracteres"),
  })
  .strict();

type CancelOrderItemQuantityInput = z.infer<
  typeof cancelOrderItemQuantitySchema
>;

export { cancelOrderItemQuantitySchema };
export type { CancelOrderItemQuantityInput };
