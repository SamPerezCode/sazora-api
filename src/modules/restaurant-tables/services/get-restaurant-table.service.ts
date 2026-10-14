import { AppError } from "../../../shared/errors/app-error";
import type { RestaurantTable } from "../restaurant-table.types";
import { findRestaurantTableById } from "../repositories/restaurant-table.repository";

type GetRestaurantTableOptions = Readonly<{
  locationId?: string;
  activeOnly: boolean;
}>;

const getRestaurantTable = async (
  businessId: string,
  restaurantTableId: string,
  options: GetRestaurantTableOptions,
): Promise<RestaurantTable> => {
  const restaurantTable = await findRestaurantTableById(
    businessId,
    restaurantTableId,
    options.locationId,
    options.activeOnly,
  );

  if (!restaurantTable) {
    throw new AppError(
      "La mesa no existe o no pertenece a la ubicación",
      404,
      "RESTAURANT_TABLE_NOT_FOUND",
    );
  }

  return restaurantTable;
};

export { getRestaurantTable };
