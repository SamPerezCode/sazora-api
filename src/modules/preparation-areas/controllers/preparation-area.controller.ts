import type { RequestHandler } from "express";

import type { AuthenticatedSession } from "../../auth/auth.types";
import { AppError } from "../../../shared/errors/app-error";
import { createPreparationAreaSchema } from "../schemas/create-preparation-area.schema";
import { preparationAreaQuerySchema } from "../schemas/preparation-area-query.schema";
import { createPreparationArea } from "../services/create-preparation-area.service";
import { listPreparationAreas } from "../services/list-preparation-areas.service";
import { updatePreparationArea } from "../services/update-preparation-area.service";
import { changePreparationAreaStatus } from "../services/update-preparation-area-status.service";
import { getPreparationArea } from "../services/get-preparation-area.service";
import { updatePreparationAreaStatusSchema } from "../schemas/update-preparation-area-status.schema";
import {
  preparationAreaIdParamsSchema,
  updatePreparationAreaSchema,
} from "../schemas/update-preparation-area.schema";

const requireAuth = (
  request: Parameters<RequestHandler>[0],
): AuthenticatedSession => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const resolveLocationScope = (
  auth: AuthenticatedSession,
  requestedLocationId?: string,
): string | undefined => {
  if (auth.roles.includes("ADMIN")) {
    return requestedLocationId;
  }

  const locationId =
    requestedLocationId ?? auth.locationAccess.defaultLocationId;

  if (!locationId) {
    throw new AppError(
      "Debes tener una ubicación predeterminada para consultar las áreas",
      409,
      "DEFAULT_LOCATION_REQUIRED",
    );
  }

  const hasAccess = auth.locationAccess.locations.some(
    (location) => location.id === locationId,
  );

  if (!hasAccess) {
    throw new AppError(
      "No tienes acceso a esta ubicación",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }

  return locationId;
};

const createPreparationAreaController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const input = createPreparationAreaSchema.parse(request.body);

  const preparationArea = await createPreparationArea(auth.businessId, input);

  response.status(201).json({
    status: "success",
    data: { preparationArea },
  });
};

const listPreparationAreasController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = preparationAreaQuerySchema.parse(request.query);
  const isAdmin = auth.roles.includes("ADMIN");

  const locationId = resolveLocationScope(auth, query.locationId);

  const preparationAreas = await listPreparationAreas(auth.businessId, {
    ...(locationId === undefined ? {} : { locationId }),
    activeOnly: isAdmin ? query.activeOnly : true,
  });

  response.status(200).json({
    status: "success",
    data: { preparationAreas },
  });
};

const getPreparationAreaController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = preparationAreaQuerySchema.parse(request.query);
  const { preparationAreaId } = preparationAreaIdParamsSchema.parse(
    request.params,
  );

  const isAdmin = auth.roles.includes("ADMIN");
  const locationId = resolveLocationScope(auth, query.locationId);

  const preparationArea = await getPreparationArea(
    auth.businessId,
    preparationAreaId,
    {
      ...(locationId === undefined ? {} : { locationId }),
      activeOnly: !isAdmin,
    },
  );

  response.status(200).json({
    status: "success",
    data: { preparationArea },
  });
};

const updatePreparationAreaController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { preparationAreaId } = preparationAreaIdParamsSchema.parse(
    request.params,
  );

  const input = updatePreparationAreaSchema.parse(request.body);

  const preparationArea = await updatePreparationArea(
    auth.businessId,
    preparationAreaId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { preparationArea },
  });
};

const updatePreparationAreaStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { preparationAreaId } = preparationAreaIdParamsSchema.parse(
    request.params,
  );

  const input = updatePreparationAreaStatusSchema.parse(request.body);

  const preparationArea = await changePreparationAreaStatus(
    auth.businessId,
    preparationAreaId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { preparationArea },
  });
};

export {
  createPreparationAreaController,
  getPreparationAreaController,
  listPreparationAreasController,
  updatePreparationAreaController,
  updatePreparationAreaStatusController,
};
