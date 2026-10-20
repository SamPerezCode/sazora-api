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

const productionOrderStatusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

const productionReportDateFieldSchema = z.enum([
  "CREATED",
  "PLANNED",
  "STARTED",
  "COMPLETED",
]);

const productionReportGroupBySchema = z.enum([
  "LOCATION",
  "OUTPUT",
  "EMPLOYEE",
]);

const validatePeriod = (
  input: {
    from: string;
    to: string;
  },
  context: z.RefinementCtx,
): void => {
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

  const differenceInDays =
    (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);

  if (differenceInDays > 366) {
    context.addIssue({
      code: "custom",
      path: ["to"],
      message: "El rango del reporte no puede superar 366 días",
    });
  }
};

const commonProductionReportFields = {
  from: dateStringSchema,
  to: dateStringSchema,

  /*
   * CREATED permite incluir órdenes pendientes y terminadas.
   * Para análisis contable normalmente se utilizará COMPLETED.
   */
  dateField: productionReportDateFieldSchema.default("CREATED"),

  locationId: databaseIdSchema.optional(),

  outputInventoryItemId: databaseIdSchema.optional(),

  membershipId: databaseIdSchema.optional(),

  status: productionOrderStatusSchema.optional(),

  search: z.string().trim().min(1).max(100).optional(),
};

const productionOrderHistoryQuerySchema = z
  .object({
    ...commonProductionReportFields,

    page: z.coerce.number().int().min(1).default(1),

    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .superRefine(validatePeriod);

const productionReportSummaryQuerySchema = z
  .object({
    ...commonProductionReportFields,
  })
  .strict()
  .superRefine(validatePeriod);

const productionGroupedReportQuerySchema = z
  .object({
    ...commonProductionReportFields,

    groupBy: productionReportGroupBySchema.default("LOCATION"),
  })
  .strict()
  .superRefine(validatePeriod);

type ProductionOrderHistoryQuery = z.infer<
  typeof productionOrderHistoryQuerySchema
>;

type ProductionReportSummaryQuery = z.infer<
  typeof productionReportSummaryQuerySchema
>;

type ProductionGroupedReportQuery = z.infer<
  typeof productionGroupedReportQuerySchema
>;

export {
  productionGroupedReportQuerySchema,
  productionOrderHistoryQuerySchema,
  productionReportSummaryQuerySchema,
};

export type {
  ProductionGroupedReportQuery,
  ProductionOrderHistoryQuery,
  ProductionReportSummaryQuery,
};
