import { AppError } from "../../../shared/errors/app-error";
import type {
  RestaurantTable,
  UpdateRestaurantTableData,
} from "../restaurant-table.types";
import {
  findRestaurantTableById,
  updateRestaurantTable as updateRestaurantTableRecord,
} from "../repositories/restaurant-table.repository";
import type { UpdateRestaurantTableInput } from "../schemas/update-restaurant-table.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const updateRestaurantTable = async (
  businessId: string,
  restaurantTableId: string,
  input: UpdateRestaurantTableInput,
): Promise<RestaurantTable> => {
  const currentTable = await findRestaurantTableById(
    businessId,
    restaurantTableId,
  );

  if (!currentTable) {
    throw new AppError("La mesa no existe", 404, "RESTAURANT_TABLE_NOT_FOUND");
  }

  const data: UpdateRestaurantTableData = {
    code: input.code ?? currentTable.code,
    name: input.name ?? currentTable.name,
    capacity:
      input.capacity !== undefined ? input.capacity : currentTable.capacity,
  };

  try {
    return await updateRestaurantTableRecord(
      businessId,
      restaurantTableId,
      data,
    );
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

export { updateRestaurantTable };
