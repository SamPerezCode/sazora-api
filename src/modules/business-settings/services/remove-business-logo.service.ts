import { AppError } from "../../../shared/errors/app-error";
import { removeBusinessLogo } from "../../../shared/images/business-logo.storage";
import type { BusinessSettings } from "../business-settings.types";
import {
  findBusinessSettingsByBusinessId,
  updateBusinessLogo,
} from "../repositories/business-settings.repository";

const removeBusinessLogoReference = async (
  businessId: string,
): Promise<BusinessSettings> => {
  const currentSettings = await findBusinessSettingsByBusinessId(businessId);

  if (!currentSettings) {
    throw new AppError(
      "No se encontró la configuración del negocio",
      404,
      "BUSINESS_SETTINGS_NOT_FOUND",
    );
  }

  if (!currentSettings.logoUrl) {
    return currentSettings;
  }

  const settings = await updateBusinessLogo(businessId, null);

  if (!settings) {
    throw new Error("No fue posible recuperar la configuración actualizada");
  }

  try {
    await removeBusinessLogo(currentSettings.logoUrl);
  } catch (error) {
    console.error(
      "No fue posible eliminar el logo anterior del negocio",
      error,
    );
  }

  return settings;
};

export { removeBusinessLogoReference };
