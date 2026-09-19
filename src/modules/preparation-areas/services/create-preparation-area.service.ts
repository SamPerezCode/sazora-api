import { AppError } from "../../../shared/errors/app-error";
import type { PreparationArea } from "../preparation-area.types";
import { createPreparationArea as createPreparationAreaRecord } from "../repositories/preparation-area.repository";
import type { CreatePreparationAreaInput } from "../schemas/create-preparation-area.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const createPreparationArea = async (
  businessId: string,
  input: CreatePreparationAreaInput,
): Promise<PreparationArea> => {
  try {
    return await createPreparationAreaRecord(businessId, input);
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

export { createPreparationArea };
