import { z } from "zod";

const restaurantTableQuerySchema = z
  .object({
    locationId: z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/, "El identificador de ubicación no es válido")
      .optional(),

    activeOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional()
      .default(false),
  })
  .strict();

type RestaurantTableQuery = z.infer<typeof restaurantTableQuerySchema>;

export { restaurantTableQuerySchema };
export type { RestaurantTableQuery };
