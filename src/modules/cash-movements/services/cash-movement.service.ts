import type { AuthenticatedSession } from "../../auth/auth.types";
import { findCashSessionById } from "../../cash-sessions/repositories/cash-session.repository";
import { AppError } from "../../../shared/errors/app-error";
import type {
  CashMovement,
  CreateManualCashMovementData,
} from "../cash-movement.types";
import {
  findCashMovementsBySessionId,
  insertManualCashMovement,
} from "../repositories/cash-movement.repository";
import type { CreateManualCashMovementInput } from "../schemas/cash-movement.schema";

const getAccessibleCashSession = async (
  auth: AuthenticatedSession,
  cashSessionId: string,
) => {
  const cashSession = await findCashSessionById(auth.businessId, cashSessionId);

  if (!cashSession) {
    throw new AppError(
      "El turno de caja no existe",
      404,
      "CASH_SESSION_NOT_FOUND",
    );
  }

  if (
    !auth.locationAccess.hasGlobalAccess &&
    !auth.locationAccess.locations.some(
      (location) => location.id === cashSession.cashRegister.locationId,
    )
  ) {
    throw new AppError(
      "No tienes acceso a la ubicación de este turno",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }

  return cashSession;
};

const listCashMovements = async (
  auth: AuthenticatedSession,
  cashSessionId: string,
): Promise<CashMovement[]> => {
  await getAccessibleCashSession(auth, cashSessionId);

  return findCashMovementsBySessionId(auth.businessId, cashSessionId);
};

const createManualCashMovement = async (
  auth: AuthenticatedSession,
  input: CreateManualCashMovementInput,
): Promise<CashMovement> => {
  const cashSession = await getAccessibleCashSession(auth, input.cashSessionId);

  if (cashSession.status !== "OPEN") {
    throw new AppError(
      "No se pueden registrar movimientos en un turno cerrado",
      409,
      "CASH_SESSION_NOT_OPEN",
    );
  }

  const data: CreateManualCashMovementData = {
    cashSessionId: input.cashSessionId,
    recordedByMembershipId: auth.membershipId,
    movementType: input.movementType,
    amount: input.amount,
    reason: input.reason,
    reference: input.reference,
  };

  const result = await insertManualCashMovement(auth.businessId, data);

  switch (result.kind) {
    case "CREATED":
      return result.cashMovement;

    case "CASH_SESSION_NOT_FOUND":
      throw new AppError(
        "El turno de caja no existe",
        404,
        "CASH_SESSION_NOT_FOUND",
      );

    case "CASH_SESSION_NOT_OPEN":
      throw new AppError(
        "No se pueden registrar movimientos en un turno cerrado",
        409,
        "CASH_SESSION_NOT_OPEN",
      );
  }
};

export { createManualCashMovement, listCashMovements };
