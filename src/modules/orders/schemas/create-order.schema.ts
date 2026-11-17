import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const nullableText = (maximum: number, message: string) =>
  z
    .string()
    .trim()
    .max(maximum, message)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }

      return value;
    });

const nullablePhoneSchema = z
  .string()
  .trim()
  .max(30, "El teléfono no puede superar 30 caracteres")
  .regex(/^\+?[0-9\s()-]+$/, "El teléfono contiene caracteres no permitidos")
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return value;
  });

const nullableEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("El correo electrónico no es válido")
  .max(254, "El correo no puede superar 254 caracteres")
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return value;
  });

const initialOrderItemSchema = z
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

const createOrderSchema = z
  .object({
    locationId: databaseIdSchema.optional(),

    serviceType: z.enum(["TABLE", "TAKEAWAY", "DELIVERY"]),

    sourceChannel: z
      .enum(["IN_PERSON", "WHATSAPP", "PHONE"])
      .optional()
      .default("IN_PERSON"),

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

    customerName: nullableText(
      150,
      "El nombre no puede superar 150 caracteres",
    ),

    customerPhone: nullablePhoneSchema,

    customerEmail: nullableEmailSchema,

    notes: z
      .string()
      .trim()
      .max(500, "Las notas no pueden superar 500 caracteres")
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    items: z
      .array(initialOrderItemSchema)
      .min(1, "Debes enviar al menos un producto")
      .max(50, "No puedes agregar más de 50 productos por petición"),
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

    if (
      (input.sourceChannel === "WHATSAPP" || input.sourceChannel === "PHONE") &&
      input.customerName === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["customerName"],
        message: "El nombre del cliente es obligatorio para este canal",
      });
    }

    if (
      (input.sourceChannel === "WHATSAPP" || input.sourceChannel === "PHONE") &&
      input.customerPhone === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["customerPhone"],
        message: "El teléfono del cliente es obligatorio para este canal",
      });
    }
  });

type CreateOrderInput = z.infer<typeof createOrderSchema>;

export { createOrderSchema };
export type { CreateOrderInput };
