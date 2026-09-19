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
    return await createRestaurantTableRecord(businessId, input);
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una mesa con ese código",
        409,
        "RESTAURANT_TABLE_CODE_CONFLICT",
      );
    }

    throw error;
  }
};

export { createRestaurantTable };
