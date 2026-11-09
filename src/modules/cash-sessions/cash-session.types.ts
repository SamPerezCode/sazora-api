import type { CashRegister } from "../cash-registers/cash-register.types";

type CashSessionStatus = "OPEN" | "CLOSED";

interface CashSessionEmployee {
  membershipId: string;
  fullName: string;
}

interface CashSession {
  id: string;
  businessId: string;
  cashRegisterId: string;
  openedByMembershipId: string;
  closedByMembershipId: string | null;
  openedBy: CashSessionEmployee;
  closedBy: CashSessionEmployee | null;
  status: CashSessionStatus;
  currencyCode: string;
  openingCashAmount: string;
  expectedCashAmount: string | null;
  countedCashAmount: string | null;
  differenceAmount: string | null;
  openingNotes: string | null;
  closingNotes: string | null;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cashRegister: CashRegister;
}

interface OpenCashSessionData {
  cashRegisterId: string;
  openedByMembershipId: string;
  openingCashAmount: string;
  openingNotes: string | null;
}

interface CashSessionFilters {
  locationId?: string;
  cashRegisterId?: string;
  status?: CashSessionStatus;
}

export type {
  CashSession,
  CashSessionEmployee,
  CashSessionFilters,
  CashSessionStatus,
  OpenCashSessionData,
};
