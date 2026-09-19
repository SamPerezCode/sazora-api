import { AppError } from "../../../shared/errors/app-error";
import type { RestaurantTable } from "../restaurant-table.types";
import {
  findRestaurantTableById,
  updateRestaurantTableStatus,
} from "../repositories/restaurant-table.repository";
import type { UpdateRestaurantTableStatusInput } from "../schemas/update-restaurant-table-status.schema";

const changeRestaurantTableStatus = async (
  businessId: string,
  restaurantTableId: string,
  input: UpdateRestaurantTableStatusInput,
): Promise<RestaurantTable> => {
  const restaurantTable = await findRestaurantTableById(
    businessId,
    restaurantTableId,
  );

  if (!restaurantTable) {
    throw new AppError("La mesa no existe", 404, "RESTAURANT_TABLE_NOT_FOUND");
  }

  if (restaurantTable.isActive === input.isActive) {
    return restaurantTable;
  }

  return updateRestaurantTableStatus(
    businessId,
    restaurantTableId,
    input.isActive,
  );
};

export { changeRestaurantTableStatus };
