import type { RequestHandler } from "express";

import type { AuthenticatedSession } from "../../auth/auth.types";
import { AppError } from "../../../shared/errors/app-error";
import { createRestaurantTableSchema } from "../schemas/create-restaurant-table.schema";
import { restaurantTableIdParamsSchema } from "../schemas/restaurant-table-params.schema";
import { restaurantTableQuerySchema } from "../schemas/restaurant-table-query.schema";
import { updateRestaurantTableStatusSchema } from "../schemas/update-restaurant-table-status.schema";
import { updateRestaurantTableSchema } from "../schemas/update-restaurant-table.schema";
import { createRestaurantTable } from "../services/create-restaurant-table.service";
import { getRestaurantTable } from "../services/get-restaurant-table.service";
import { listRestaurantTables } from "../services/list-restaurant-tables.service";
import { changeRestaurantTableStatus } from "../services/update-restaurant-table-status.service";
import { updateRestaurantTable } from "../services/update-restaurant-table.service";

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
      "Debes tener un punto de venta predeterminado para consultar las mesas",
      409,
      "DEFAULT_LOCATION_REQUIRED",
    );
  }

  const assignedLocation = auth.locationAccess.locations.find(
    (location) => location.id === locationId,
  );

  if (!assignedLocation) {
    throw new AppError(
      "No tienes acceso a esta ubicación",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }

  if (assignedLocation.locationType !== "POINT_OF_SALE") {
    throw new AppError(
      "Las mesas solamente están disponibles en puntos de venta",
      409,
      "LOCATION_NOT_POINT_OF_SALE",
    );
  }

  return locationId;
};

const createRestaurantTableController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const input = createRestaurantTableSchema.parse(request.body);

  const restaurantTable = await createRestaurantTable(auth.businessId, input);

  response.status(201).json({
    status: "success",
    data: { restaurantTable },
  });
};

const listRestaurantTablesController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = restaurantTableQuerySchema.parse(request.query);
  const isAdmin = auth.roles.includes("ADMIN");
  const locationId = resolveLocationScope(auth, query.locationId);

  const restaurantTables = await listRestaurantTables(auth.businessId, {
    ...(locationId === undefined ? {} : { locationId }),
    activeOnly: isAdmin ? query.activeOnly : true,
  });

  response.status(200).json({
    status: "success",
    data: { restaurantTables },
  });
};

const getRestaurantTableController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = restaurantTableQuerySchema.parse(request.query);
  const isAdmin = auth.roles.includes("ADMIN");
  const locationId = resolveLocationScope(auth, query.locationId);

  const { restaurantTableId } = restaurantTableIdParamsSchema.parse(
    request.params,
  );

  const restaurantTable = await getRestaurantTable(
    auth.businessId,
    restaurantTableId,
    {
      ...(locationId === undefined ? {} : { locationId }),
      activeOnly: !isAdmin,
    },
  );

  response.status(200).json({
    status: "success",
    data: { restaurantTable },
  });
};

const updateRestaurantTableController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { restaurantTableId } = restaurantTableIdParamsSchema.parse(
    request.params,
  );

  const input = updateRestaurantTableSchema.parse(request.body);

  const restaurantTable = await updateRestaurantTable(
    auth.businessId,
    restaurantTableId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { restaurantTable },
  });
};

const updateRestaurantTableStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { restaurantTableId } = restaurantTableIdParamsSchema.parse(
    request.params,
  );

  const input = updateRestaurantTableStatusSchema.parse(request.body);

  const restaurantTable = await changeRestaurantTableStatus(
    auth.businessId,
    restaurantTableId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { restaurantTable },
  });
};

export {
  createRestaurantTableController,
  getRestaurantTableController,
  listRestaurantTablesController,
  updateRestaurantTableController,
  updateRestaurantTableStatusController,
};
