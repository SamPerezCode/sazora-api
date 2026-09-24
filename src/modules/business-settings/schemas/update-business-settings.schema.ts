import { z } from "zod";

const optionalText = (maximum: number, message: string) =>
  z.string().trim().min(1, message).max(maximum, message).nullable().optional();

const colorSchema = z
  .string()
  .trim()
  .regex(
    /^#[0-9A-Fa-f]{6}$/,
    "El color debe tener formato hexadecimal, por ejemplo #1F4534",
  )
  .transform((value) => value.toUpperCase());

const updateBusinessSettingsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(120, "El nombre no puede superar 120 caracteres")
      .optional(),

    tagline: optionalText(
      160,
      "El eslogan debe contener entre 1 y 160 caracteres",
    ),

    phone: optionalText(
      30,
      "El teléfono debe contener entre 1 y 30 caracteres",
    ),

    address: optionalText(
      250,
      "La dirección debe contener entre 1 y 250 caracteres",
    ),

    openingHoursText: optionalText(
      200,
      "El horario debe contener entre 1 y 200 caracteres",
    ),

    instagram: optionalText(
      100,
      "Instagram debe contener entre 1 y 100 caracteres",
    ),

    taxId: optionalText(
      50,
      "La identificación fiscal debe contener entre 1 y 50 caracteres",
    ),

    primaryColor: colorSchema.optional(),
    accentColor: colorSchema.optional(),

    kitchenTicketFooter: optionalText(
      500,
      "El texto de la comanda debe contener entre 1 y 500 caracteres",
    ),

    publicMenuDescription: optionalText(
      500,
      "La descripción del menú debe contener entre 1 y 500 caracteres",
    ),

    publicMenuEnabled: z.boolean().optional(),
    publicOrderingEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Debes enviar al menos un campo para actualizar",
  });

type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;

export { updateBusinessSettingsSchema };

export type { UpdateBusinessSettingsInput };
