import { AppError } from "../../../shared/errors/app-error";
import type {
  PreparationArea,
  UpdatePreparationAreaData,
} from "../preparation-area.types";
import {
  findPreparationAreaById,
  updatePreparationArea as updatePreparationAreaRecord,
} from "../repositories/preparation-area.repository";
import type { UpdatePreparationAreaInput } from "../schemas/update-preparation-area.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const updatePreparationArea = async (
  businessId: string,
  preparationAreaId: string,
  input: UpdatePreparationAreaInput,
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

  const data: UpdatePreparationAreaData = {
    name: input.name ?? currentArea.name,
    description:
      input.description === undefined
        ? currentArea.description
        : input.description,
    displayOrder: input.displayOrder ?? currentArea.displayOrder,
    locationIds: input.locationIds ?? null,
  };

  try {
    const result = await updatePreparationAreaRecord(
      businessId,
      preparationAreaId,
      data,
    );

    if (result.kind === "PREPARATION_AREA_NOT_FOUND") {
      throw new AppError(
        "El área de preparación no existe",
        404,
        "PREPARATION_AREA_NOT_FOUND",
      );
    }

    if (result.kind === "LOCATIONS_NOT_AVAILABLE") {
      throw new AppError(
        "Una o varias ubicaciones no existen, están inactivas o no pertenecen al negocio",
        409,
        "PREPARATION_AREA_LOCATIONS_NOT_AVAILABLE",
      );
    }

    return result.preparationArea;
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe un área de preparación con ese nombre",
        409,
        "PREPARATION_AREA_NAME_CONFLICT",
      );
    }

    throw error;
  }
};

export { updatePreparationArea };
