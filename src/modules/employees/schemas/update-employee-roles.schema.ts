import { z } from "zod";

const updateEmployeeRolesSchema = z
  .object({
    roles: z
      .array(
        z.enum([
          "WAITER",
          "KITCHEN",
          "PUBLIC_ORDER_MANAGER",
          "DELIVERY_DRIVER",
          "PRODUCTION",
        ]),
      )
      .min(1, "Debes asignar al menos un rol")
      .max(5, "No puedes asignar más de cinco roles")
      .transform((roles) => [...new Set(roles)]),
  })
  .strict();

type UpdateEmployeeRolesInput = z.infer<typeof updateEmployeeRolesSchema>;

export { updateEmployeeRolesSchema };
export type { UpdateEmployeeRolesInput };
