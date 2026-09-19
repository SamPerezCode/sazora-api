import { z } from "zod";

const restaurantTableIdParamsSchema = z
  .object({
    restaurantTableId: z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/, "El identificador de la mesa no es válido"),
  })
  .strict();

export { restaurantTableIdParamsSchema };
