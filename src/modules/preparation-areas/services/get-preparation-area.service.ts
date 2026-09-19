import { AppError } from "../../../shared/errors/app-error";
import type { PreparationArea } from "../preparation-area.types";
import { findPreparationAreaById } from "../repositories/preparation-area.repository";

const getPreparationArea = async (
  businessId: string,
  preparationAreaId: string,
): Promise<PreparationArea> => {
  const preparationArea = await findPreparationAreaById(
    businessId,
    preparationAreaId,
  );

  if (!preparationArea) {
    throw new AppError(
      "El área de preparación no existe",
      404,
      "PREPARATION_AREA_NOT_FOUND",
    );
  }

  return preparationArea;
};

export { getPreparationArea };
