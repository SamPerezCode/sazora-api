import type { RequestHandler } from "express";

import type { AuthenticatedSession } from "../../auth/auth.types";
import { findCashRegisterById } from "../../cash-registers/repositories/cash-register.repository";
import { AppError } from "../../../shared/errors/app-error";

import {
  closeCashSession,
  listCashSessions,
  openCashSession,
} from "../services/cash-session.service";
import {
  cashSessionIdParamsSchema,
  cashSessionQuerySchema,
  closeCashSessionSchema,
  openCashSessionSchema,
} from "../schemas/cash-session.schema";

import { findCashSessionById } from "../repositories/cash-session.repository";
import { getCashSessionReconciliation } from "../services/cash-session-reconciliation.service";

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

const assertLocationAccess = (
  auth: AuthenticatedSession,
  locationId: string,
): void => {
  if (auth.locationAccess.hasGlobalAccess) {
    return;
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

  assertLocationAccess(auth, locationId);

  return locationId;
};

const listCashSessionsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = cashSessionQuerySchema.parse(request.query);
  const locationId = resolveLocationScope(auth, query.locationId);

  const cashSessions = await listCashSessions(auth.businessId, {
    ...(locationId === undefined ? {} : { locationId }),
    ...(query.cashRegisterId === undefined
      ? {}
      : { cashRegisterId: query.cashRegisterId }),
    ...(query.status === undefined ? {} : { status: query.status }),
  });

  response.status(200).json({
    status: "success",
    data: {
      cashSessions,
    },
  });
};

const openCashSessionController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const input = openCashSessionSchema.parse(request.body);

  const cashRegister = await findCashRegisterById(
    auth.businessId,
    input.cashRegisterId,
  );

  if (cashRegister) {
    assertLocationAccess(auth, cashRegister.locationId);
  }

  const cashSession = await openCashSession(
    auth.businessId,
    auth.membershipId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      cashSession,
    },
  });
};

const closeCashSessionController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { cashSessionId } = cashSessionIdParamsSchema.parse(request.params);

  const input = closeCashSessionSchema.parse(request.body);

  const currentCashSession = await findCashSessionById(
    auth.businessId,
    cashSessionId,
  );

  if (currentCashSession) {
    assertLocationAccess(auth, currentCashSession.cashRegister.locationId);
  }

  const cashSession = await closeCashSession(
    auth.businessId,
    auth.membershipId,
    cashSessionId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      cashSession,
    },
  });
};

const getCashSessionReconciliationController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { cashSessionId } = cashSessionIdParamsSchema.parse(request.params);

  const reconciliation = await getCashSessionReconciliation(
    auth,
    cashSessionId,
  );

  response.status(200).json({
    status: "success",
    data: {
      reconciliation,
    },
  });
};

export {
  closeCashSessionController,
  getCashSessionReconciliationController,
  listCashSessionsController,
  openCashSessionController,
};
