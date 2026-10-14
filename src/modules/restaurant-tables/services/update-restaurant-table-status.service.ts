import { AppError } from "../../../shared/errors/app-error";
import type { RestaurantTable } from "../restaurant-table.types";
import { updateRestaurantTableStatus } from "../repositories/restaurant-table.repository";
import type { UpdateRestaurantTableStatusInput } from "../schemas/update-restaurant-table-status.schema";

const changeRestaurantTableStatus = async (
  businessId: string,
  restaurantTableId: string,
  input: UpdateRestaurantTableStatusInput,
): Promise<RestaurantTable> => {
  const result = await updateRestaurantTableStatus(
    businessId,
    restaurantTableId,
    input.isActive,
  );

  if (result.kind === "RESTAURANT_TABLE_NOT_FOUND") {
    throw new AppError("La mesa no existe", 404, "RESTAURANT_TABLE_NOT_FOUND");
  }

  if (result.kind === "RESTAURANT_TABLE_HAS_ACTIVE_ORDER") {
    throw new AppError(
      "No puedes desactivar una mesa mientras tenga una orden activa",
      409,
      "RESTAURANT_TABLE_HAS_ACTIVE_ORDER",
    );
  }

  return result.restaurantTable;
};

export { changeRestaurantTableStatus };
