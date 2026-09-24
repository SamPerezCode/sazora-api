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
        ]),
      )
      .min(1, "Debes asignar al menos un rol")
      .max(4, "No puedes asignar más de cuatro roles")
      .transform((roles) => [...new Set(roles)]),
  })
  .strict();

type UpdateEmployeeRolesInput = z.infer<typeof updateEmployeeRolesSchema>;

export { updateEmployeeRolesSchema };
export type { UpdateEmployeeRolesInput };
