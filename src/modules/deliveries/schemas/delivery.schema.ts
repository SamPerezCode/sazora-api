import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const deliveryIdParamsSchema = z
  .object({
    deliveryId: databaseIdSchema,
  })
  .strict();

const publicOrderRequestDeliveryParamsSchema = z
  .object({
    requestId: databaseIdSchema,
  })
  .strict();

const internalDeliverySchema = z
  .object({
    deliveryMode: z.literal("INTERNAL"),
    driverMembershipId: databaseIdSchema,
    externalProviderName: z.null().optional(),
  })
  .strict();

const externalDeliverySchema = z
  .object({
    deliveryMode: z.literal("EXTERNAL"),
    driverMembershipId: z.null().optional(),
    externalProviderName: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .strict();

const pendingDeliverySchema = z
  .object({
    deliveryMode: z.null(),
    driverMembershipId: z.null().optional(),
    externalProviderName: z.null().optional(),
  })
  .strict();

const assignDeliverySchema = z.union([
  internalDeliverySchema,
  externalDeliverySchema,
  pendingDeliverySchema,
]);

export {
  assignDeliverySchema,
  deliveryIdParamsSchema,
  publicOrderRequestDeliveryParamsSchema,
};
