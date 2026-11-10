import { z } from "zod";

const productAvailabilityQuerySchema = z.object({
  locationId: z
    .string()
    .trim()
    .regex(/^\d+$/, "La ubicación no tiene un formato válido"),
});

export { productAvailabilityQuerySchema };
