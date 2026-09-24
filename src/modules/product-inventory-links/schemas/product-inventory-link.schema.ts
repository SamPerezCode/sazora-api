import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const positiveQuantitySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/,
    "La cantidad debe tener máximo tres decimales",
  )
  .refine((value) => Number(value) > 0, "La cantidad debe ser mayor que cero");

const productInventoryLinkIdParamsSchema = z
  .object({
    productInventoryLinkId: databaseIdSchema,
  })
  .strict();

const createProductInventoryLinkSchema = z
  .object({
    productId: databaseIdSchema,
    inventoryItemId: databaseIdSchema,
    quantityPerProduct: positiveQuantitySchema,
    autoDeduct: z.boolean().default(true),
  })
  .strict();

const updateProductInventoryLinkSchema = z
  .object({
    quantityPerProduct: positiveQuantitySchema.optional(),
    autoDeduct: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Debes enviar al menos un campo",
  );

const updateProductInventoryLinkStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export {
  createProductInventoryLinkSchema,
  productInventoryLinkIdParamsSchema,
  updateProductInventoryLinkSchema,
  updateProductInventoryLinkStatusSchema,
};
