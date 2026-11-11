import { AppError } from "../../../shared/errors/app-error";
import type { AuthenticatedSession } from "../../auth/auth.types";
import type { CashSessionReconciliation } from "../cash-session-reconciliation.types";
import { findCashSessionById } from "../repositories/cash-session.repository";
import { findCashSessionReconciliation } from "../repositories/cash-session-reconciliation.repository";

const getCashSessionReconciliation = async (
  auth: AuthenticatedSession,
  cashSessionId: string,
): Promise<CashSessionReconciliation> => {
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

  const reconciliation = await findCashSessionReconciliation(
    auth.businessId,
    cashSessionId,
  );

  return {
    cashSession,
    ...reconciliation,
  };
};

export { getCashSessionReconciliation };
