import { z } from "zod";

const updateCategoryStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

type UpdateCategoryStatusInput = z.infer<typeof updateCategoryStatusSchema>;

export { updateCategoryStatusSchema };
export type { UpdateCategoryStatusInput };
