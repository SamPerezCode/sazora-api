import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const voidSaleSchema = z
  .object({
    cashSessionId: databaseIdSchema,

    reason: z
      .string()
      .trim()
      .min(5, "El motivo debe tener al menos 5 caracteres")
      .max(500, "El motivo no puede superar 500 caracteres"),
  })
  .strict();

type VoidSaleInput = z.infer<typeof voidSaleSchema>;

export { voidSaleSchema };
export type { VoidSaleInput };
