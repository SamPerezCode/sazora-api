import { z } from "zod";

const updateRestaurantTableStatusSchema = z
  .object({
    isActive: z.boolean({
      error: "El estado debe ser verdadero o falso",
    }),
  })
  .strict();

type UpdateRestaurantTableStatusInput = z.infer<
  typeof updateRestaurantTableStatusSchema
>;

export { updateRestaurantTableStatusSchema };
export type { UpdateRestaurantTableStatusInput };
