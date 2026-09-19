import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { createRestaurantTableSchema } from "../schemas/create-restaurant-table.schema";
import { restaurantTableIdParamsSchema } from "../schemas/restaurant-table-params.schema";
import { createRestaurantTable } from "../services/create-restaurant-table.service";
import { getRestaurantTable } from "../services/get-restaurant-table.service";
import { listRestaurantTables } from "../services/list-restaurant-tables.service";
import { updateRestaurantTableStatusSchema } from "../schemas/update-restaurant-table-status.schema";
import { updateRestaurantTableSchema } from "../schemas/update-restaurant-table.schema";
import { changeRestaurantTableStatus } from "../services/update-restaurant-table-status.service";
import { updateRestaurantTable } from "../services/update-restaurant-table.service";

const createRestaurantTableController: RequestHandler = async (
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

  const input = createRestaurantTableSchema.parse(request.body);

  const restaurantTable = await createRestaurantTable(
    request.auth.businessId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      restaurantTable,
    },
  });
};

const listRestaurantTablesController: RequestHandler = async (
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

  const restaurantTables = await listRestaurantTables(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      restaurantTables,
    },
  });
};

const getRestaurantTableController: RequestHandler = async (
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

  const { restaurantTableId } = restaurantTableIdParamsSchema.parse(
    request.params,
  );

  const restaurantTable = await getRestaurantTable(
    request.auth.businessId,
    restaurantTableId,
  );

  response.status(200).json({
    status: "success",
    data: {
      restaurantTable,
    },
  });
};

const updateRestaurantTableController: RequestHandler = async (
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

  const { restaurantTableId } = restaurantTableIdParamsSchema.parse(
    request.params,
  );

  const input = updateRestaurantTableSchema.parse(request.body);

  const restaurantTable = await updateRestaurantTable(
    request.auth.businessId,
    restaurantTableId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      restaurantTable,
    },
  });
};

const updateRestaurantTableStatusController: RequestHandler = async (
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

  const { restaurantTableId } = restaurantTableIdParamsSchema.parse(
    request.params,
  );

  const input = updateRestaurantTableStatusSchema.parse(request.body);

  const restaurantTable = await changeRestaurantTableStatus(
    request.auth.businessId,
    restaurantTableId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      restaurantTable,
    },
  });
};

export {
  createRestaurantTableController,
  getRestaurantTableController,
  listRestaurantTablesController,
  updateRestaurantTableController,
  updateRestaurantTableStatusController,
};
