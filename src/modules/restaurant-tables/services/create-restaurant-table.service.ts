import { AppError } from "../../../shared/errors/app-error";
import type { RestaurantTable } from "../restaurant-table.types";
import { createRestaurantTable as createRestaurantTableRecord } from "../repositories/restaurant-table.repository";
import type { CreateRestaurantTableInput } from "../schemas/create-restaurant-table.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const createRestaurantTable = async (
  businessId: string,
  input: CreateRestaurantTableInput,
): Promise<RestaurantTable> => {
  try {
    const result = await createRestaurantTableRecord(businessId, input);

    if (result.kind === "LOCATION_NOT_AVAILABLE") {
      throw new AppError(
        "La ubicación no existe, está inactiva o no pertenece al negocio",
        409,
        "RESTAURANT_TABLE_LOCATION_NOT_AVAILABLE",
      );
    }

    if (result.kind === "LOCATION_NOT_POINT_OF_SALE") {
      throw new AppError(
        "Las mesas solamente pueden crearse en puntos de venta",
        409,
        "LOCATION_NOT_POINT_OF_SALE",
      );
    }

    return result.restaurantTable;
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una mesa con ese código en la ubicación",
        409,
        "RESTAURANT_TABLE_CODE_CONFLICT",
      );
    }

    throw error;
  }
};

export { createRestaurantTable };
