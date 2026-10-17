import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar el formato YYYY-MM-DD")
  .refine((value) => {
    const [yearText, monthText, dayText] = value.split("-");

    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "La fecha no es válida");

const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),

  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const validatePeriod = (
  input: { from: string; to: string },
  context: z.RefinementCtx,
) => {
  if (input.from > input.to) {
    context.addIssue({
      code: "custom",
      path: ["to"],
      message: "La fecha final no puede ser anterior a la inicial",
    });

    return;
  }

  const from = new Date(`${input.from}T00:00:00.000Z`);
  const to = new Date(`${input.to}T00:00:00.000Z`);

  const difference = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);

  if (difference > 366) {
    context.addIssue({
      code: "custom",
      path: ["to"],
      message: "El rango no puede superar 366 días",
    });
  }
};

const inventorySummaryQuerySchema = z
  .object({
    locationId: databaseIdSchema.optional(),
  })
  .strict();

const inventoryKardexQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,

    locationId: databaseIdSchema.optional(),
    inventoryItemId: databaseIdSchema.optional(),

    movementType: z
      .enum([
        "OPENING",
        "PURCHASE",
        "PRODUCTION",
        "SALE",
        "ADJUSTMENT",
        "WASTE",
        "RETURN",
        "REVERSAL",
      ])
      .optional(),

    ...paginationSchema,
  })
  .strict()
  .superRefine(validatePeriod);

const inventoryPurchaseReportQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,

    locationId: databaseIdSchema.optional(),
    inventoryItemId: databaseIdSchema.optional(),

    ...paginationSchema,
  })
  .strict()
  .superRefine(validatePeriod);

type InventorySummaryQuery = z.infer<typeof inventorySummaryQuerySchema>;

type InventoryKardexQuery = z.infer<typeof inventoryKardexQuerySchema>;

type InventoryPurchaseReportQuery = z.infer<
  typeof inventoryPurchaseReportQuerySchema
>;

export {
  inventoryKardexQuerySchema,
  inventoryPurchaseReportQuerySchema,
  inventorySummaryQuerySchema,
};

export type {
  InventoryKardexQuery,
  InventoryPurchaseReportQuery,
  InventorySummaryQuery,
};
