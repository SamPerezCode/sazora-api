import { AppError } from "../../../shared/errors/app-error";
import type { RestaurantTable } from "../restaurant-table.types";
import { findRestaurantTableById } from "../repositories/restaurant-table.repository";

const getRestaurantTable = async (
  businessId: string,
  restaurantTableId: string,
): Promise<RestaurantTable> => {
  const restaurantTable = await findRestaurantTableById(
    businessId,
    restaurantTableId,
  );

  if (!restaurantTable) {
    throw new AppError("La mesa no existe", 404, "RESTAURANT_TABLE_NOT_FOUND");
  }

  return restaurantTable;
};

export { getRestaurantTable };
