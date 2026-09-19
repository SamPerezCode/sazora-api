import { z } from "zod";

const updatePreparationAreaStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

type UpdatePreparationAreaStatusInput = z.infer<
  typeof updatePreparationAreaStatusSchema
>;

export { updatePreparationAreaStatusSchema };
export type { UpdatePreparationAreaStatusInput };
