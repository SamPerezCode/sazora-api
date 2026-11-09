import type { LocationType } from "../locations/location.types";

interface CashRegisterLocation {
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  isSalesLocation: boolean;
  isActive: boolean;
}

interface CashRegister {
  id: string;
  businessId: string;
  locationId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  location: CashRegisterLocation;
}

interface CreateCashRegisterData {
  locationId: string;
  code: string;
  name: string;
}

interface CashRegisterFilters {
  locationId?: string;
  activeOnly: boolean;
}

export type {
  CashRegister,
  CashRegisterFilters,
  CashRegisterLocation,
  CreateCashRegisterData,
};
