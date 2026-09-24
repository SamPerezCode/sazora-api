import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador debe ser un entero positivo");

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "La fecha no es válida");

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener formato HH:mm");

const savePublicOrderAssignmentSchema = z
  .object({
    assignedMembershipId: databaseIdSchema,

    serviceScope: z.enum(["ALL", "DELIVERY", "TAKEAWAY"]),

    scheduleType: z.enum(["PERMANENT", "WEEKLY", "SPECIFIC_DATE"]),

    specificDate: dateSchema.nullable(),

    dayOfWeek: z.number().int().min(0).max(6).nullable(),

    startTime: timeSchema.nullable(),

    endTime: timeSchema.nullable(),

    priority: z.number().int().min(0).max(100),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.scheduleType === "PERMANENT") {
      const containsSchedule =
        data.specificDate !== null ||
        data.dayOfWeek !== null ||
        data.startTime !== null ||
        data.endTime !== null;

      if (containsSchedule) {
        context.addIssue({
          code: "custom",
          path: ["scheduleType"],
          message:
            "Una responsabilidad permanente no debe contener fecha ni horario",
        });
      }

      return;
    }

    if (data.scheduleType === "WEEKLY") {
      if (
        data.specificDate !== null ||
        data.dayOfWeek === null ||
        data.startTime === null ||
        data.endTime === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["scheduleType"],
          message:
            "La programación semanal requiere día, hora inicial y hora final",
        });
      }
    }

    if (data.scheduleType === "SPECIFIC_DATE") {
      if (
        data.specificDate === null ||
        data.dayOfWeek !== null ||
        data.startTime === null ||
        data.endTime === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["scheduleType"],
          message:
            "La programación por fecha requiere fecha, hora inicial y hora final",
        });
      }
    }

    if (
      data.startTime !== null &&
      data.endTime !== null &&
      data.startTime >= data.endTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "La hora final debe ser posterior a la hora inicial",
      });
    }
  });

const publicOrderAssignmentIdParamsSchema = z
  .object({
    assignmentId: databaseIdSchema,
  })
  .strict();

const updatePublicOrderAssignmentStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export {
  publicOrderAssignmentIdParamsSchema,
  savePublicOrderAssignmentSchema,
  updatePublicOrderAssignmentStatusSchema,
};

/*
| Valor | Día |
|---:|---|
| `0` | Domingo |
| `1` | Lunes |
| `2` | Martes |
| `3` | Miércoles |
| `4` | Jueves |
| `5` | Viernes |
| `6` | Sábado |
*/
