import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const kitchenSettingsParamsSchema = z
  .object({
    locationId: databaseIdSchema,
  })
  .strict();

const updateKitchenSettingsSchema = z
  .object({
    workflowMode: z.enum(["PRINT_ONLY", "PRINT_AND_SCREEN"]),
  })
  .strict();

type UpdateKitchenSettingsInput = z.infer<typeof updateKitchenSettingsSchema>;

export { kitchenSettingsParamsSchema, updateKitchenSettingsSchema };

export type { UpdateKitchenSettingsInput };
