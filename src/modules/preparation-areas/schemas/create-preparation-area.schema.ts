import { z } from "zod";

const databaseIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "El identificador de ubicación no es válido");

const createPreparationAreaSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre del área es obligatorio")
      .max(100, "El nombre no puede superar 100 caracteres"),

    description: z
      .string()
      .trim()
      .max(255, "La descripción no puede superar 255 caracteres")
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    displayOrder: z
      .number()
      .int("El orden debe ser un número entero")
      .min(0, "El orden no puede ser negativo")
      .max(65535, "El orden no puede superar 65535")
      .default(0),

    locationIds: z
      .array(databaseIdSchema)
      .min(1, "Debes asignar el área al menos a una ubicación")
      .max(100, "No puedes asignar más de 100 ubicaciones")
      .refine(
        (locationIds) => new Set(locationIds).size === locationIds.length,
        "No puedes repetir ubicaciones",
      ),
  })
  .strict();

type CreatePreparationAreaInput = z.infer<typeof createPreparationAreaSchema>;

export { createPreparationAreaSchema };
export type { CreatePreparationAreaInput };
