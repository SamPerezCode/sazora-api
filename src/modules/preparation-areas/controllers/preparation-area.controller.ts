import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { createPreparationAreaSchema } from "../schemas/create-preparation-area.schema";
import { createPreparationArea } from "../services/create-preparation-area.service";
import { listPreparationAreas } from "../services/list-preparation-areas.service";
import { updatePreparationArea } from "../services/update-preparation-area.service";
import { changePreparationAreaStatus } from "../services/update-preparation-area-status.service";
import { updatePreparationAreaStatusSchema } from "../schemas/update-preparation-area-status.schema";
import {
  preparationAreaIdParamsSchema,
  updatePreparationAreaSchema,
} from "../schemas/update-preparation-area.schema";

const createPreparationAreaController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const input = createPreparationAreaSchema.parse(request.body);

  const preparationArea = await createPreparationArea(
    request.auth.businessId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      preparationArea,
    },
  });
};

const listPreparationAreasController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const preparationAreas = await listPreparationAreas(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      preparationAreas,
    },
  });
};

const updatePreparationAreaController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { preparationAreaId } = preparationAreaIdParamsSchema.parse(
    request.params,
  );

  const input = updatePreparationAreaSchema.parse(request.body);

  const preparationArea = await updatePreparationArea(
    request.auth.businessId,
    preparationAreaId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      preparationArea,
    },
  });
};

const updatePreparationAreaStatusController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { preparationAreaId } = preparationAreaIdParamsSchema.parse(
    request.params,
  );

  const input = updatePreparationAreaStatusSchema.parse(request.body);

  const preparationArea = await changePreparationAreaStatus(
    request.auth.businessId,
    preparationAreaId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      preparationArea,
    },
  });
};

export {
  createPreparationAreaController,
  listPreparationAreasController,
  updatePreparationAreaController,
  updatePreparationAreaStatusController,
};
