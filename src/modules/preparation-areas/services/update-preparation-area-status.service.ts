import { AppError } from "../../../shared/errors/app-error";
import type { PreparationArea } from "../preparation-area.types";
import {
  findPreparationAreaById,
  updatePreparationAreaStatus,
} from "../repositories/preparation-area.repository";
import type { UpdatePreparationAreaStatusInput } from "../schemas/update-preparation-area-status.schema";

const changePreparationAreaStatus = async (
  businessId: string,
  preparationAreaId: string,
  input: UpdatePreparationAreaStatusInput,
): Promise<PreparationArea> => {
  const currentArea = await findPreparationAreaById(
    businessId,
    preparationAreaId,
  );

  if (!currentArea) {
    throw new AppError(
      "El área de preparación no existe",
      404,
      "PREPARATION_AREA_NOT_FOUND",
    );
  }

  if (currentArea.isActive === input.isActive) {
    return currentArea;
  }

  return updatePreparationAreaStatus(
    businessId,
    preparationAreaId,
    input.isActive,
  );
};

export { changePreparationAreaStatus };
