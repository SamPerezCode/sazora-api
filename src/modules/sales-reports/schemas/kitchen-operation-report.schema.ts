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

const kitchenOperationReportQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,

    locationId: databaseIdSchema.optional(),
    preparationAreaId: databaseIdSchema.optional(),

    workflowMode: z.enum(["PRINT_ONLY", "PRINT_AND_SCREEN"]).optional(),

    serviceType: z.enum(["TABLE", "TAKEAWAY", "DELIVERY"]).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.from > input.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "La fecha final no puede ser anterior a la fecha inicial",
      });

      return;
    }

    const fromDate = new Date(`${input.from}T00:00:00.000Z`);
    const toDate = new Date(`${input.to}T00:00:00.000Z`);

    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    const differenceInDays =
      (toDate.getTime() - fromDate.getTime()) / millisecondsPerDay;

    if (differenceInDays > 366) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "El rango no puede superar 366 días",
      });
    }
  });

type KitchenOperationReportQuery = z.infer<
  typeof kitchenOperationReportQuerySchema
>;

export { kitchenOperationReportQuerySchema };
export type { KitchenOperationReportQuery };
