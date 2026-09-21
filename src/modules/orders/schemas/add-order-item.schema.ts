import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const orderIdParamsSchema = z
  .object({
    orderId: databaseIdSchema,
  })
  .strict();

const newOrderItemSchema = z
  .object({
    productId: databaseIdSchema,

    quantity: z
      .number()
      .int("La cantidad debe ser un número entero")
      .min(1, "La cantidad debe ser mayor que cero")
      .max(65535, "La cantidad no puede superar 65535"),

    notes: z
      .string()
      .trim()
      .max(500, "Las observaciones no pueden superar 500 caracteres")
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .strict();

const addOrderItemsSchema = z
  .object({
    items: z
      .array(newOrderItemSchema)
      .min(1, "Debes enviar al menos un producto")
      .max(50, "No puedes agregar más de 50 productos por petición"),
  })
  .strict();

const orderItemIdParamsSchema = z
  .object({
    orderId: databaseIdSchema,
    orderItemId: databaseIdSchema,
  })
  .strict();

type AddOrderItemsInput = z.infer<typeof addOrderItemsSchema>;

export { addOrderItemsSchema, orderIdParamsSchema, orderItemIdParamsSchema };
export type { AddOrderItemsInput };
