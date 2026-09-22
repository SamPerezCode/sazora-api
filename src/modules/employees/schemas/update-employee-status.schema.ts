import { z } from "zod";

const updateEmployeeStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

type UpdateEmployeeStatusInput = z.infer<typeof updateEmployeeStatusSchema>;

export { updateEmployeeStatusSchema };
export type { UpdateEmployeeStatusInput };
