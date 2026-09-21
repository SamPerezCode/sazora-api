import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const updateOrderSchema = z
  .object({
    serviceType: z.enum(["TABLE", "TAKEAWAY", "DELIVERY"]).optional(),

    restaurantTableId: databaseIdSchema.nullable().optional(),

    customerCount: z
      .number()
      .int("La cantidad de clientes debe ser un número entero")
      .min(1, "La cantidad de clientes debe ser mayor que cero")
      .max(65535, "La cantidad de clientes no puede superar 65535")
      .nullable()
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
  .superRefine((input, context) => {
    const hasServiceType = input.serviceType !== undefined;
    const hasRestaurantTableId = input.restaurantTableId !== undefined;

    if (!hasServiceType && hasRestaurantTableId) {
      context.addIssue({
        code: "custom",
        path: ["serviceType"],
        message: "Debes enviar serviceType cuando quieras cambiar la mesa",
      });
    }

    if (
      input.serviceType === "TABLE" &&
      (input.restaurantTableId === undefined ||
        input.restaurantTableId === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["restaurantTableId"],
        message: "Las órdenes de mesa requieren una mesa",
      });
    }

    if (
      input.serviceType !== undefined &&
      input.serviceType !== "TABLE" &&
      input.restaurantTableId !== undefined &&
      input.restaurantTableId !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["restaurantTableId"],
        message: "Las órdenes para llevar o domicilio no pueden tener una mesa",
      });
    }

    const hasValue = Object.values(input).some((value) => value !== undefined);

    if (!hasValue) {
      context.addIssue({
        code: "custom",
        message: "Debes enviar al menos un campo para actualizar",
      });
    }
  });

type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export { updateOrderSchema };
export type { UpdateOrderInput };
