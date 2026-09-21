import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const createOrderSchema = z
  .object({
    serviceType: z.enum(["TABLE", "TAKEAWAY", "DELIVERY"]),

    restaurantTableId: databaseIdSchema
      .nullable()
      .optional()
      .transform((value) => value ?? null),

    customerCount: z
      .number()
      .int("La cantidad de clientes debe ser un número entero")
      .min(1, "La cantidad de clientes debe ser mayor que cero")
      .max(65535, "La cantidad de clientes no puede superar 65535")
      .nullable()
      .optional()
      .transform((value) => value ?? null),

    notes: z
      .string()
      .trim()
      .max(500, "Las notas no pueden superar 500 caracteres")
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.serviceType === "TABLE" && input.restaurantTableId === null) {
      context.addIssue({
        code: "custom",
        path: ["restaurantTableId"],
        message: "Las órdenes de mesa requieren una mesa",
      });
    }

    if (input.serviceType !== "TABLE" && input.restaurantTableId !== null) {
      context.addIssue({
        code: "custom",
        path: ["restaurantTableId"],
        message: "Las órdenes para llevar o domicilio no pueden tener una mesa",
      });
    }
  });

type CreateOrderInput = z.infer<typeof createOrderSchema>;

export { createOrderSchema };
export type { CreateOrderInput };
