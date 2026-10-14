import { AppError } from "../../../shared/errors/app-error";
import type { PreparationArea } from "../preparation-area.types";
import { findPreparationAreaById } from "../repositories/preparation-area.repository";

type GetPreparationAreaOptions = Readonly<{
  locationId?: string;
  activeOnly: boolean;
}>;

const getPreparationArea = async (
  businessId: string,
  preparationAreaId: string,
  options: GetPreparationAreaOptions,
): Promise<PreparationArea> => {
  const preparationArea = await findPreparationAreaById(
    businessId,
    preparationAreaId,
    options.locationId,
    options.activeOnly,
  );

  if (!preparationArea) {
    throw new AppError(
      "El área de preparación no existe o no está asignada a la ubicación",
      404,
      "PREPARATION_AREA_NOT_FOUND",
    );
  }

  return preparationArea;
};

export { getPreparationArea };
