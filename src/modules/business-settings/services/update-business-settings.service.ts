import { AppError } from "../../../shared/errors/app-error";
import type {
  BusinessSettings,
  UpdateBusinessSettingsData,
} from "../business-settings.types";
import {
  findBusinessSettingsByBusinessId,
  updateBusinessSettings as updateBusinessSettingsRecord,
} from "../repositories/business-settings.repository";
import type { UpdateBusinessSettingsInput } from "../schemas/update-business-settings.schema";

const updateBusinessSettings = async (
  businessId: string,
  input: UpdateBusinessSettingsInput,
): Promise<BusinessSettings> => {
  const currentSettings = await findBusinessSettingsByBusinessId(businessId);

  if (!currentSettings) {
    throw new AppError(
      "La configuración del negocio no existe",
      404,
      "BUSINESS_SETTINGS_NOT_FOUND",
    );
  }

  const data: UpdateBusinessSettingsData = {
    name: input.name ?? currentSettings.name,
    tagline:
      input.tagline === undefined ? currentSettings.tagline : input.tagline,
    phone: input.phone === undefined ? currentSettings.phone : input.phone,
    address:
      input.address === undefined ? currentSettings.address : input.address,
    openingHoursText:
      input.openingHoursText === undefined
        ? currentSettings.openingHoursText
        : input.openingHoursText,
    instagram:
      input.instagram === undefined
        ? currentSettings.instagram
        : input.instagram,
    taxId: input.taxId === undefined ? currentSettings.taxId : input.taxId,
    primaryColor: input.primaryColor ?? currentSettings.primaryColor,
    accentColor: input.accentColor ?? currentSettings.accentColor,
    kitchenTicketFooter:
      input.kitchenTicketFooter === undefined
        ? currentSettings.kitchenTicketFooter
        : input.kitchenTicketFooter,
    publicMenuDescription:
      input.publicMenuDescription === undefined
        ? currentSettings.publicMenuDescription
        : input.publicMenuDescription,
    publicMenuEnabled:
      input.publicMenuEnabled ?? currentSettings.publicMenuEnabled,
    publicOrderingEnabled:
      input.publicOrderingEnabled ?? currentSettings.publicOrderingEnabled,
  };

  if (data.publicOrderingEnabled && !data.publicMenuEnabled) {
    throw new AppError(
      "Debes habilitar el menú público antes de recibir pedidos públicos",
      409,
      "PUBLIC_MENU_REQUIRED",
    );
  }

  const settings = await updateBusinessSettingsRecord(businessId, data);

  if (!settings) {
    throw new AppError("El negocio no existe", 404, "BUSINESS_NOT_FOUND");
  }

  return settings;
};

export { updateBusinessSettings };
