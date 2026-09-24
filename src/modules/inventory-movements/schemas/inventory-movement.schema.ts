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

const optionalText = z
  .string()
  .trim()
  .max(500)
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
    movementType: z.enum(["PURCHASE", "ADJUSTMENT", "WASTE", "RETURN"]),

    notes: optionalText,

    lines: z
      .array(
        z
          .object({
            inventoryItemId: databaseIdSchema,
            direction: z.enum(["IN", "OUT"]),
            quantity: positiveQuantitySchema,
            notes: optionalText,
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

    if (data.movementType === "PURCHASE" || data.movementType === "RETURN") {
      data.lines.forEach((line, index) => {
        if (line.direction !== "IN") {
          context.addIssue({
            code: "custom",
            path: ["lines", index, "direction"],
            message: "Las compras y devoluciones solamente permiten entradas",
          });
        }
      });
    }

    if (data.movementType === "WASTE") {
      data.lines.forEach((line, index) => {
        if (line.direction !== "OUT") {
          context.addIssue({
            code: "custom",
            path: ["lines", index, "direction"],
            message: "Las pérdidas solamente permiten salidas",
          });
        }
      });
    }
  });

export { createInventoryMovementSchema, inventoryMovementIdParamsSchema };
