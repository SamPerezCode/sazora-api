import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const employeeMembershipIdParamsSchema = z
  .object({
    employeeMembershipId: databaseIdSchema,
  })
  .strict();

export { employeeMembershipIdParamsSchema };
