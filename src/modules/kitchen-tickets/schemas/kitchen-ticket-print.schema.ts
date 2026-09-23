import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const nullableReasonSchema = z
  .string()
  .trim()
  .max(500, "El motivo no puede superar 500 caracteres")
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const nullablePrinterNameSchema = z
  .string()
  .trim()
  .max(150, "El nombre de la impresora no puede superar 150 caracteres")
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const kitchenTicketPrintParamsSchema = z
  .object({
    kitchenTicketId: databaseIdSchema,
  })
  .strict();

const kitchenTicketReprintParamsSchema = z
  .object({
    kitchenTicketId: databaseIdSchema,
    kitchenTicketPrintId: databaseIdSchema,
  })
  .strict();

const createKitchenTicketPrintSchema = z
  .object({
    reason: nullableReasonSchema,
    printerName: nullablePrinterNameSchema,
  })
  .strict();

const reprintKitchenTicketSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Debes indicar el motivo de la reimpresión")
      .max(500, "El motivo no puede superar 500 caracteres"),

    printerName: nullablePrinterNameSchema,
  })
  .strict();

type CreateKitchenTicketPrintInput = z.infer<
  typeof createKitchenTicketPrintSchema
>;

type ReprintKitchenTicketInput = z.infer<typeof reprintKitchenTicketSchema>;

export {
  createKitchenTicketPrintSchema,
  kitchenTicketPrintParamsSchema,
  kitchenTicketReprintParamsSchema,
  reprintKitchenTicketSchema,
};

export type { CreateKitchenTicketPrintInput, ReprintKitchenTicketInput };
