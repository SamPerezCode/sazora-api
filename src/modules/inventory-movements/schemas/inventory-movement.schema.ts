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
  .refine((value) => Number(value) > 0, {
    message: "La cantidad debe ser mayor que cero",
  });

const positiveCostSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/,
    "El costo debe tener máximo seis decimales",
  )
  .refine((value) => Number(value) > 0, {
    message: "El costo debe ser mayor que cero",
  });

const optionalUnitCostSchema = positiveCostSchema
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const optionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalReferenceSchema = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const inventoryMovementIdParamsSchema = z
  .object({
    inventoryMovementId: databaseIdSchema,
  })
  .strict();

const createInventoryMovementSchema = z
  .object({
    locationId: databaseIdSchema,

    movementType: z.enum(["ADJUSTMENT", "WASTE", "RETURN"]),

    returnKind: z
      .enum(["CUSTOMER_RETURN", "SUPPLIER_RETURN"])
      .nullable()
      .optional()
      .transform((value) => value ?? null),

    externalReference: optionalReferenceSchema,

    notes: z
      .string()
      .trim()
      .min(1, "Debes indicar el motivo del movimiento")
      .max(500),

    lines: z
      .array(
        z
          .object({
            inventoryItemId: databaseIdSchema,
            direction: z.enum(["IN", "OUT"]),
            quantity: positiveQuantitySchema,
            unitCost: optionalUnitCostSchema,
            notes: optionalTextSchema,
          })
          .strict(),
      )
      .min(1, "El movimiento requiere al menos una línea")
      .max(100, "El movimiento no puede superar 100 líneas"),
  })
  .strict()
  .superRefine((data, context) => {
    const itemIds = data.lines.map((line) => line.inventoryItemId);

    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Un artículo no puede repetirse en el mismo movimiento",
      });
    }

    if (data.movementType !== "RETURN" && data.returnKind !== null) {
      context.addIssue({
        code: "custom",
        path: ["returnKind"],
        message: "El tipo de devolución solamente aplica a movimientos RETURN",
      });
    }

    if (data.movementType === "RETURN" && data.returnKind === null) {
      context.addIssue({
        code: "custom",
        path: ["returnKind"],
        message: "Debes indicar el tipo de devolución",
      });
    }

    data.lines.forEach((line, index) => {
      if (data.movementType === "WASTE" && line.direction !== "OUT") {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "direction"],
          message: "Los desperdicios solamente permiten salidas",
        });
      }

      if (data.returnKind === "CUSTOMER_RETURN" && line.direction !== "IN") {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "direction"],
          message: "Las devoluciones de clientes solamente permiten entradas",
        });
      }

      if (data.returnKind === "SUPPLIER_RETURN" && line.direction !== "OUT") {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "direction"],
          message: "Las devoluciones a proveedores solamente permiten salidas",
        });
      }

      if (line.direction === "OUT" && line.unitCost !== null) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "unitCost"],
          message: "Las salidas siempre usan el costo promedio vigente",
        });
      }
    });
  });

export { createInventoryMovementSchema, inventoryMovementIdParamsSchema };
