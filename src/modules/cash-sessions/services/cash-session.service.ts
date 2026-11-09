import { AppError } from "../../../shared/errors/app-error";
import type {
  CashSession,
  CashSessionFilters,
  OpenCashSessionData,
} from "../cash-session.types";
import {
  findCashSessions,
  openCashSession as openCashSessionRecord,
} from "../repositories/cash-session.repository";
import type { OpenCashSessionInput } from "../schemas/cash-session.schema";

const listCashSessions = async (
  businessId: string,
  filters: CashSessionFilters,
): Promise<CashSession[]> => findCashSessions(businessId, filters);

const openCashSession = async (
  businessId: string,
  membershipId: string,
  input: OpenCashSessionInput,
): Promise<CashSession> => {
  const data: OpenCashSessionData = {
    cashRegisterId: input.cashRegisterId,
    openedByMembershipId: membershipId,
    openingCashAmount: input.openingCashAmount,
    openingNotes: input.openingNotes,
  };

  const result = await openCashSessionRecord(businessId, data);

  switch (result.kind) {
    case "OPENED":
      return result.cashSession;

    case "CASH_REGISTER_NOT_FOUND":
      throw new AppError("La caja no existe", 404, "CASH_REGISTER_NOT_FOUND");

    case "CASH_REGISTER_INACTIVE":
      throw new AppError(
        "La caja está inactiva",
        409,
        "CASH_REGISTER_INACTIVE",
      );

    case "LOCATION_NOT_AVAILABLE":
      throw new AppError(
        "La ubicación de la caja está inactiva",
        409,
        "LOCATION_NOT_AVAILABLE",
      );

    case "LOCATION_NOT_SALES_ENABLED":
      throw new AppError(
        "La ubicación de la caja no está habilitada para ventas",
        409,
        "LOCATION_NOT_SALES_ENABLED",
      );

    case "CASH_SESSION_ALREADY_OPEN":
      throw new AppError(
        "La caja ya tiene un turno abierto",
        409,
        "CASH_SESSION_ALREADY_OPEN",
      );
  }
};

export { listCashSessions, openCashSession };
