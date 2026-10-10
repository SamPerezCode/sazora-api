import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "El identificador no es válido");

const nullableText = (maximum: number, message: string) =>
  z
    .string()
    .trim()
    .max(maximum, message)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const locationTypeSchema = z.enum(["PRODUCTION_WAREHOUSE", "POINT_OF_SALE"]);

const locationCodeSchema = z
  .string()
  .trim()
  .min(2, "El código debe contener al menos 2 caracteres")
  .max(30, "El código no puede superar 30 caracteres")
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
        "El código solo admite letras, números y guiones",
      ),
  );

const locationIdParamsSchema = z
  .object({
    locationId: databaseIdSchema,
  })
  .strict();

const createLocationSchema = z
  .object({
    code: locationCodeSchema,

    name: z
      .string()
      .trim()
      .min(2, "El nombre debe contener al menos 2 caracteres")
      .max(150, "El nombre no puede superar 150 caracteres"),

    locationType: locationTypeSchema,

    address: nullableText(250, "La dirección no puede superar 250 caracteres"),

    countryCode: z
      .string()
      .trim()
      .length(2, "El código del país debe tener 2 caracteres")
      .transform((value) => value.toUpperCase())
      .default("CO"),

    departmentCode: nullableText(
      5,
      "El código del departamento no puede superar 5 caracteres",
    ),

    departmentName: nullableText(
      100,
      "El departamento no puede superar 100 caracteres",
    ),

    municipalityCode: nullableText(
      10,
      "El código del municipio no puede superar 10 caracteres",
    ),

    municipalityName: nullableText(
      100,
      "El municipio no puede superar 100 caracteres",
    ),

    postalCode: nullableText(
      12,
      "El código postal no puede superar 12 caracteres",
    ),

    phone: nullableText(30, "El teléfono no puede superar 30 caracteres"),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo no es válido")
      .max(254)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .strict();

const updateLocationSchema = z
  .object({
    code: locationCodeSchema.optional(),

    name: z.string().trim().min(2).max(150).optional(),

    locationType: locationTypeSchema.optional(),

    address: nullableText(250, "La dirección no es válida"),

    countryCode: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase())
      .optional(),

    departmentCode: nullableText(5, "El código del departamento no es válido"),

    departmentName: nullableText(100, "El departamento no es válido"),

    municipalityCode: nullableText(10, "El código del municipio no es válido"),

    municipalityName: nullableText(100, "El municipio no es válido"),

    postalCode: nullableText(12, "El código postal no es válido"),
    phone: nullableText(30, "El teléfono no es válido"),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo no es válido")
      .max(254)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Debes enviar al menos un campo para actualizar",
  });

const updateLocationStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

type CreateLocationInput = z.infer<typeof createLocationSchema>;
type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
type UpdateLocationStatusInput = z.infer<typeof updateLocationStatusSchema>;

export {
  createLocationSchema,
  locationIdParamsSchema,
  updateLocationSchema,
  updateLocationStatusSchema,
};

export type {
  CreateLocationInput,
  UpdateLocationInput,
  UpdateLocationStatusInput,
};
