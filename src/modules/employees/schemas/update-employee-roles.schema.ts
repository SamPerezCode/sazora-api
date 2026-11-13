import { z } from "zod";

const updateEmployeeRolesSchema = z
  .object({
    roles: z
      .array(
        z.enum([
          "ADMIN",
          "WAITER",
          "KITCHEN",
          "PUBLIC_ORDER_MANAGER",
          "DELIVERY_DRIVER",
          "PRODUCTION",
          "CASHIER",
          "INVENTORY_MANAGER",
        ]),
      )
      .min(1, "Debes asignar al menos un rol")
      .max(8, "No puedes asignar más de ocho roles")
      .transform((roles) => [...new Set(roles)]),
  })
  .strict();

type UpdateEmployeeRolesInput = z.infer<typeof updateEmployeeRolesSchema>;

export { updateEmployeeRolesSchema };
export type { UpdateEmployeeRolesInput };
