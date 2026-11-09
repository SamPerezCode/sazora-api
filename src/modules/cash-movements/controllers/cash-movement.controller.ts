import type { RequestHandler } from "express";

import type { AuthenticatedSession } from "../../auth/auth.types";
import { AppError } from "../../../shared/errors/app-error";
import {
  cashMovementQuerySchema,
  createManualCashMovementSchema,
} from "../schemas/cash-movement.schema";
import {
  createManualCashMovement,
  listCashMovements,
} from "../services/cash-movement.service";

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

const listCashMovementsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const query = cashMovementQuerySchema.parse(request.query);

  const cashMovements = await listCashMovements(auth, query.cashSessionId);

  response.status(200).json({
    status: "success",
    data: {
      cashMovements,
    },
  });
};

const createManualCashMovementController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const input = createManualCashMovementSchema.parse(request.body);

  const cashMovement = await createManualCashMovement(auth, input);

  response.status(201).json({
    status: "success",
    data: {
      cashMovement,
    },
  });
};

export { createManualCashMovementController, listCashMovementsController };
