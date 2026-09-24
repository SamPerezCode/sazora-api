import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const optionalText = (maximumLength: number) =>
  z
    .string()
    .trim()
    .max(maximumLength, `El texto no puede superar ${maximumLength} caracteres`)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const createPublicOrderRequestSchema = z
  .object({
    serviceType: z.enum(["DELIVERY", "TAKEAWAY"]),

    customerName: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(150, "El nombre no puede superar 150 caracteres"),

    customerPhone: z
      .string()
      .trim()
      .min(7, "El teléfono no es válido")
      .max(30, "El teléfono no puede superar 30 caracteres")
      .regex(
        /^\+?[0-9\s()-]+$/,
        "El teléfono contiene caracteres no permitidos",
      ),

    customerEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo electrónico no es válido")
      .max(254, "El correo no puede superar 254 caracteres")
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    deliveryAddress: optionalText(300),

    notes: optionalText(500),

    items: z
      .array(
        z
          .object({
            productId: databaseIdSchema,
            quantity: z.number().int().min(1).max(100),
            notes: optionalText(500),
          })
          .strict(),
      )
      .min(1, "La solicitud debe contener al menos un producto")
      .max(50, "La solicitud no puede superar 50 productos"),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.serviceType === "DELIVERY" && data.deliveryAddress === null) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Los domicilios requieren una dirección",
      });
    }

    if (data.serviceType === "TAKEAWAY" && data.deliveryAddress !== null) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Las solicitudes para recoger no deben incluir dirección",
      });
    }

    const productIds = data.items.map((item) => item.productId);

    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Un producto no puede repetirse; aumenta su cantidad",
      });
    }
  });

const publicOrderRequestIdParamsSchema = z
  .object({
    requestId: databaseIdSchema,
  })
  .strict();

const publicBusinessSlugParamsSchema = z
  .object({
    businessSlug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "El identificador del negocio no es válido",
      ),
  })
  .strict();

const rejectPublicOrderRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "La razón del rechazo es obligatoria")
      .max(500, "La razón del rechazo no puede superar 500 caracteres"),
  })
  .strict();

const publicOrderTrackingParamsSchema = z
  .object({
    businessSlug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "El identificador del negocio no es válido",
      ),

    publicCode: z.string().trim().uuid("El código público no es válido"),
  })
  .strict();

export {
  createPublicOrderRequestSchema,
  publicBusinessSlugParamsSchema,
  publicOrderRequestIdParamsSchema,
  publicOrderTrackingParamsSchema,
  rejectPublicOrderRequestSchema,
};
