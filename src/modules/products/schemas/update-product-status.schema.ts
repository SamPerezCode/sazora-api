import { z } from "zod";

const updateProductStatusSchema = z
  .object({
    isActive: z.boolean({
      error: "El estado debe ser verdadero o falso",
    }),
  })
  .strict();

type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;

export { updateProductStatusSchema };
export type { UpdateProductStatusInput };
