import { z } from "zod";

const roleSelectionTokenSchema = z
  .string()
  .trim()
  .min(1, "El token de selección es obligatorio")
  .max(4096, "El token de selección no es válido");

const roleCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]*$/, "El código del rol no tiene un formato válido");

const selectRoleSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ALL_ROLES"),
    roleSelectionToken: roleSelectionTokenSchema,
  }),

  z.object({
    mode: z.literal("SINGLE_ROLE"),
    role: roleCodeSchema,
    roleSelectionToken: roleSelectionTokenSchema,
  }),
]);

type SelectRoleInput = z.infer<typeof selectRoleSchema>;

export { selectRoleSchema };
export type { SelectRoleInput };
