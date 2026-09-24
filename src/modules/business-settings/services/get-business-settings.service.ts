import { AppError } from "../../../shared/errors/app-error";
import type { BusinessSettings } from "../business-settings.types";
import { findBusinessSettingsByBusinessId } from "../repositories/business-settings.repository";

const getBusinessSettings = async (
  businessId: string,
): Promise<BusinessSettings> => {
  const settings = await findBusinessSettingsByBusinessId(businessId);

  if (!settings) {
    throw new AppError(
      "La configuración del negocio no existe",
      404,
      "BUSINESS_SETTINGS_NOT_FOUND",
    );
  }

  return settings;
};

export { getBusinessSettings };
