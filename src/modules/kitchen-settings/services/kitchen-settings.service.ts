import { AppError } from "../../../shared/errors/app-error";
import type { LocationKitchenSettings } from "../kitchen-settings.types";
import {
  findLocationKitchenSettings,
  upsertLocationKitchenSettings,
} from "../repositories/kitchen-settings.repository";
import type { UpdateKitchenSettingsInput } from "../schemas/kitchen-settings.schema";

const validateLocation = (
  settings: LocationKitchenSettings | null,
): LocationKitchenSettings => {
  if (!settings) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  if (!settings.location.isActive) {
    throw new AppError("La ubicación está inactiva", 409, "LOCATION_INACTIVE");
  }

  if (settings.location.locationType !== "POINT_OF_SALE") {
    throw new AppError(
      "La configuración de comandas solo aplica a puntos de venta",
      409,
      "LOCATION_NOT_POINT_OF_SALE",
    );
  }

  return settings;
};

const getKitchenSettings = async (
  businessId: string,
  locationId: string,
): Promise<LocationKitchenSettings> => {
  const settings = await findLocationKitchenSettings(businessId, locationId);

  return validateLocation(settings);
};

const updateKitchenSettings = async (
  businessId: string,
  locationId: string,
  input: UpdateKitchenSettingsInput,
): Promise<LocationKitchenSettings> => {
  const current = await findLocationKitchenSettings(businessId, locationId);

  validateLocation(current);

  const updated = await upsertLocationKitchenSettings(
    businessId,
    locationId,
    input.workflowMode,
  );

  if (!updated) {
    throw new Error(
      "No fue posible recuperar la configuración de cocina actualizada",
    );
  }

  return updated;
};

export { getKitchenSettings, updateKitchenSettings };
