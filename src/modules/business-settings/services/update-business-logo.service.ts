import { AppError } from "../../../shared/errors/app-error";
import {
  removeBusinessLogo,
  storeBusinessLogo,
} from "../../../shared/images/business-logo.storage";
import type { BusinessSettings } from "../business-settings.types";
import {
  findBusinessSettingsByBusinessId,
  updateBusinessLogo,
} from "../repositories/business-settings.repository";

const replaceBusinessLogo = async (
  businessId: string,
  imageBuffer: Buffer,
): Promise<BusinessSettings> => {
  const currentSettings = await findBusinessSettingsByBusinessId(businessId);

  if (!currentSettings) {
    throw new AppError(
      "No se encontró la configuración del negocio",
      404,
      "BUSINESS_SETTINGS_NOT_FOUND",
    );
  }

  const newLogoUrl = await storeBusinessLogo(imageBuffer);

  let settings: BusinessSettings | null;

  try {
    settings = await updateBusinessLogo(businessId, newLogoUrl);

    if (!settings) {
      throw new Error("No fue posible recuperar la configuración actualizada");
    }
  } catch (error) {
    await removeBusinessLogo(newLogoUrl);
    throw error;
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

export { replaceBusinessLogo };
