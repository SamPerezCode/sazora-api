import { z } from "zod";

const updateEmployeeRolesSchema = z
  .object({
    roles: z
      .array(z.enum(["WAITER", "KITCHEN"]))
      .min(1, "Debes asignar al menos un rol")
      .max(2, "No puedes asignar más de dos roles")
      .transform((roles) => [...new Set(roles)]),
  })
  .strict();

type UpdateEmployeeRolesInput = z.infer<typeof updateEmployeeRolesSchema>;

export { updateEmployeeRolesSchema };
export type { UpdateEmployeeRolesInput };
