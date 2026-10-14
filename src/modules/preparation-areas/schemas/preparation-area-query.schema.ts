import { z } from "zod";

const preparationAreaQuerySchema = z
  .object({
    locationId: z
      .string()
      .regex(/^[1-9]\d*$/, "El identificador de ubicación no es válido")
      .optional(),

    activeOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional()
      .default(false),
  })
  .strict();

type PreparationAreaQuery = z.infer<typeof preparationAreaQuerySchema>;

export { preparationAreaQuerySchema };
export type { PreparationAreaQuery };
