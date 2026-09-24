import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const publicCategoryIdParamsSchema = z
  .object({
    categoryId: databaseIdSchema,
  })
  .strict();

const publicProductIdParamsSchema = z
  .object({
    productId: databaseIdSchema,
  })
  .strict();

const updatePublicCategoryVisibilitySchema = z
  .object({
    isPubliclyVisible: z.boolean(),
  })
  .strict();

const updatePublicProductSettingsSchema = z
  .object({
    isPubliclyVisible: z.boolean(),
    isPubliclyOrderable: z.boolean(),
  })
  .strict();

export {
  publicCategoryIdParamsSchema,
  publicProductIdParamsSchema,
  updatePublicCategoryVisibilitySchema,
  updatePublicProductSettingsSchema,
};
