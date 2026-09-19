import type { RestaurantTable } from "../restaurant-table.types";
import { findRestaurantTablesByBusinessId } from "../repositories/restaurant-table.repository";

const listRestaurantTables = async (
  businessId: string,
): Promise<RestaurantTable[]> => {
  return findRestaurantTablesByBusinessId(businessId);
};

export { listRestaurantTables };
