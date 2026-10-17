import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const inventoryLocationBalanceQuerySchema = z
  .object({
    locationId: databaseIdSchema.optional(),
  })
  .strict();

const inventoryLocationBalanceParamsSchema = z
  .object({
    inventoryItemId: databaseIdSchema,
    locationId: databaseIdSchema,
  })
  .strict();

const initialInventoryValuationSchema = z
  .object({
    unitCost: z
      .string()
      .trim()
      .regex(
        /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/,
        "El costo debe ser positivo y tener máximo seis decimales",
      )
      .refine(
        (value) => Number(value) > 0,
        "El costo unitario debe ser mayor que cero",
      ),

    reason: z
      .string()
      .trim()
      .min(3, "Debes indicar el motivo de la valoración")
      .max(500, "El motivo no puede superar 500 caracteres"),
  })
  .strict();

type InventoryLocationBalanceQuery = z.infer<
  typeof inventoryLocationBalanceQuerySchema
>;

type InventoryLocationBalanceParams = z.infer<
  typeof inventoryLocationBalanceParamsSchema
>;

type InitialInventoryValuationInput = z.infer<
  typeof initialInventoryValuationSchema
>;

export {
  initialInventoryValuationSchema,
  inventoryLocationBalanceParamsSchema,
  inventoryLocationBalanceQuerySchema,
};

export type {
  InitialInventoryValuationInput,
  InventoryLocationBalanceParams,
  InventoryLocationBalanceQuery,
};
