import { AppError } from "../../../shared/errors/app-error";
import type { ProductCommercialAvailability } from "../product.types";
import { findProductAvailabilityByLocation } from "../repositories/product-availability.repository";

const getProductAvailabilityByLocation = async (
  businessId: string,
  locationId: string,
): Promise<readonly ProductCommercialAvailability[]> => {
  const result = await findProductAvailabilityByLocation(
    businessId,
    locationId,
  );

  switch (result.kind) {
    case "FOUND":
      return result.products;

    case "LOCATION_NOT_FOUND":
      throw new AppError(
        "La ubicación no existe o está inactiva",
        404,
        "LOCATION_NOT_FOUND",
      );

    case "LOCATION_NOT_SALES_ENABLED":
      throw new AppError(
        "La ubicación no está habilitada para ventas",
        409,
        "LOCATION_NOT_SALES_ENABLED",
      );
  }
};

export { getProductAvailabilityByLocation };
