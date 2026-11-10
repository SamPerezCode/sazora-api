import { AppError } from "../../../shared/errors/app-error";
import type { BusinessSettings } from "../business-settings.types";
import { initializeBusinessSettings as initializeBusinessSettingsRecord } from "../repositories/business-settings.repository";

type InitializeBusinessSettingsResponse = Readonly<{
  settings: BusinessSettings;
  created: boolean;
}>;

const initializeBusinessSettings = async (
  businessId: string,
): Promise<InitializeBusinessSettingsResponse> => {
  const result = await initializeBusinessSettingsRecord(businessId);

  if (!result) {
    throw new AppError(
      "El negocio autenticado no existe",
      404,
      "BUSINESS_NOT_FOUND",
    );
  }

  return result;
};

export { initializeBusinessSettings };
