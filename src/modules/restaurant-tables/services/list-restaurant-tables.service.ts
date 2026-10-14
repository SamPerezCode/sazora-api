import { AppError } from "../../../shared/errors/app-error";
import { findLocationById } from "../../locations/repositories/location.repository";
import type { RestaurantTable } from "../restaurant-table.types";
import { findRestaurantTablesByBusinessId } from "../repositories/restaurant-table.repository";

type ListRestaurantTablesOptions = Readonly<{
  locationId?: string;
  activeOnly: boolean;
}>;

const listRestaurantTables = async (
  businessId: string,
  options: ListRestaurantTablesOptions,
): Promise<RestaurantTable[]> => {
  if (options.locationId !== undefined) {
    const location = await findLocationById(businessId, options.locationId);

    if (!location) {
      throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
    }

    if (location.locationType !== "POINT_OF_SALE") {
      throw new AppError(
        "Las mesas solamente están disponibles en puntos de venta",
        409,
        "LOCATION_NOT_POINT_OF_SALE",
      );
    }
  }

  return findRestaurantTablesByBusinessId(
    businessId,
    options.locationId,
    options.activeOnly,
  );
};

export { listRestaurantTables };
