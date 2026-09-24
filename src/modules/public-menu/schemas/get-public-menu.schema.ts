import { z } from "zod";

const getPublicMenuParamsSchema = z.object({
  businessSlug: z
    .string()
    .trim()
    .min(1, "El identificador del negocio es obligatorio")
    .max(100, "El identificador del negocio no puede superar 100 caracteres")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "El identificador del negocio no tiene un formato válido",
    ),
});

export { getPublicMenuParamsSchema };
