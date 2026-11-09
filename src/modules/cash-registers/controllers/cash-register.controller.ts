import type { RequestHandler } from "express";

import type { AuthenticatedSession } from "../../auth/auth.types";
import { AppError } from "../../../shared/errors/app-error";
import {
  cashRegisterQuerySchema,
  createCashRegisterSchema,
} from "../schemas/cash-register.schema";
import {
  createCashRegister,
  listCashRegisters,
} from "../services/cash-register.service";

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
  requestedLocationId: string | undefined,
): string | undefined => {
  if (auth.locationAccess.hasGlobalAccess) {
    return requestedLocationId;
  }

  const locationId =
    requestedLocationId ?? auth.locationAccess.defaultLocationId;

  if (!locationId) {
    throw new AppError(
      "Debes tener una ubicación predeterminada",
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

  if (!assignedLocation.isSalesLocation) {
    throw new AppError(
      "Esta ubicación no está habilitada para ventas",
      409,
      "LOCATION_NOT_SALES_ENABLED",
    );
  }

  return locationId;
};

const listCashRegistersController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = cashRegisterQuerySchema.parse(request.query);
  const locationId = resolveLocationScope(auth, query.locationId);

  const cashRegisters = await listCashRegisters(auth.businessId, {
    ...(locationId === undefined ? {} : { locationId }),
    activeOnly: query.activeOnly,
  });

  response.status(200).json({
    status: "success",
    data: {
      cashRegisters,
    },
  });
};

const createCashRegisterController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const input = createCashRegisterSchema.parse(request.body);

  resolveLocationScope(auth, input.locationId);

  const cashRegister = await createCashRegister(auth.businessId, input);

  response.status(201).json({
    status: "success",
    data: {
      cashRegister,
    },
  });
};

export { createCashRegisterController, listCashRegistersController };
