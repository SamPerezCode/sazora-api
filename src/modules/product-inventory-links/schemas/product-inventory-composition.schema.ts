import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,19}$/, "El identificador no es válido")
  .pipe(
    z
      .string()
      .refine(
        (value) => BigInt(value) <= 18_446_744_073_709_551_615n,
        "El identificador supera el máximo permitido",
      ),
  );

const compositionItemSchema = z
  .object({
    inventoryItemId: databaseIdSchema,

    quantityPerProduct: z
      .string()
      .trim()
      .regex(
        /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/,
        "La cantidad debe tener máximo 15 enteros y 3 decimales",
      )
      .refine(
        (value) => Number(value) > 0,
        "La cantidad debe ser mayor que cero",
      ),

    autoDeduct: z.boolean(),
  })
  .strict();

const productInventoryCompositionParamsSchema = z
  .object({
    productId: databaseIdSchema,
  })
  .strict();

const saveProductInventoryCompositionSchema = z
  .object({
    items: z
      .array(compositionItemSchema)
      .max(100, "La composición no puede superar 100 insumos"),
  })
  .strict()
  .superRefine((input, context) => {
    const seen = new Set<string>();

    input.items.forEach((item, index) => {
      if (seen.has(item.inventoryItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "inventoryItemId"],
          message: "Un artículo no puede repetirse en la composición",
        });
      }

      seen.add(item.inventoryItemId);
    });
  });

type SaveProductInventoryCompositionInput = z.infer<
  typeof saveProductInventoryCompositionSchema
>;

export {
  productInventoryCompositionParamsSchema,
  saveProductInventoryCompositionSchema,
};

export type { SaveProductInventoryCompositionInput };
