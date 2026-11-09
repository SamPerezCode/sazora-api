import { AppError } from "../../../shared/errors/app-error";
import { findLocationById } from "../../locations/repositories/location.repository";
import type {
  CashRegister,
  CashRegisterFilters,
  CreateCashRegisterData,
} from "../cash-register.types";
import {
  findCashRegisterByLocationAndCode,
  findCashRegisters,
  insertCashRegister,
} from "../repositories/cash-register.repository";
import type { CreateCashRegisterInput } from "../schemas/cash-register.schema";

const listCashRegisters = async (
  businessId: string,
  filters: CashRegisterFilters,
): Promise<CashRegister[]> => findCashRegisters(businessId, filters);

const createCashRegister = async (
  businessId: string,
  input: CreateCashRegisterInput,
): Promise<CashRegister> => {
  const location = await findLocationById(businessId, input.locationId);

  if (!location?.isActive) {
    throw new AppError(
      "La ubicación no existe o está inactiva",
      404,
      "LOCATION_NOT_AVAILABLE",
    );
  }

  if (!location.isSalesLocation) {
    throw new AppError(
      "La ubicación no está habilitada para ventas",
      409,
      "LOCATION_NOT_SALES_ENABLED",
    );
  }

  const existingCashRegister = await findCashRegisterByLocationAndCode(
    businessId,
    input.locationId,
    input.code,
  );

  if (existingCashRegister) {
    throw new AppError(
      "Ya existe una caja con este código en la ubicación",
      409,
      "CASH_REGISTER_CODE_CONFLICT",
    );
  }

  const data: CreateCashRegisterData = {
    locationId: input.locationId,
    code: input.code,
    name: input.name,
  };

  return insertCashRegister(businessId, data);
};

export { createCashRegister, listCashRegisters };
