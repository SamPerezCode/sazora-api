import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const employeeLocationAssignmentSchema = z
  .object({
    locationId: databaseIdSchema,
    isDefault: z.boolean(),
  })
  .strict();

const updateEmployeeLocationsSchema = z
  .object({
    assignments: z
      .array(employeeLocationAssignmentSchema)
      .max(100, "No se pueden asignar más de 100 ubicaciones"),
  })
  .strict()
  .superRefine((input, context) => {
    const locationIds = input.assignments.map(({ locationId }) => locationId);

    if (new Set(locationIds).size !== locationIds.length) {
      context.addIssue({
        code: "custom",
        path: ["assignments"],
        message: "No se puede repetir una ubicación",
      });
    }

    const defaultCount = input.assignments.filter(
      ({ isDefault }) => isDefault,
    ).length;

    if (input.assignments.length > 0 && defaultCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["assignments"],
        message: "Debes seleccionar exactamente una ubicación predeterminada",
      });
    }
  });

type UpdateEmployeeLocationsInput = z.infer<
  typeof updateEmployeeLocationsSchema
>;

export { updateEmployeeLocationsSchema };

export type { UpdateEmployeeLocationsInput };
