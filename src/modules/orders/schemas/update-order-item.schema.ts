import { z } from "zod";

const updateOrderItemSchema = z
  .object({
    quantity: z
      .number()
      .int("La cantidad debe ser un número entero")
      .min(1, "La cantidad debe ser mayor que cero")
      .max(65535, "La cantidad no puede superar 65535")
      .optional(),

    notes: z
      .string()
      .trim()
      .max(500, "Las observaciones no pueden superar 500 caracteres")
      .nullable()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        return value && value.length > 0 ? value : null;
      }),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    {
      message: "Debes enviar al menos un campo para actualizar",
    },
  );

type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;

export { updateOrderItemSchema };
export type { UpdateOrderItemInput };
