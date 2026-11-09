type CashMovementType =
  | "MANUAL_INCOME"
  | "WITHDRAWAL"
  | "EXPENSE"
  | "CASH_SALE"
  | "CASH_REFUND"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT";

type ManualCashMovementType = "MANUAL_INCOME" | "WITHDRAWAL" | "EXPENSE";

type CashMovementDirection = "IN" | "OUT";

interface CashMovementEmployee {
  membershipId: string;
  fullName: string;
}

interface CashMovement {
  id: string;
  businessId: string;
  cashSessionId: string;
  recordedByMembershipId: string;
  recordedBy: CashMovementEmployee;
  movementType: CashMovementType;
  direction: CashMovementDirection;
  amount: string;
  reason: string;
  reference: string | null;
  sourceType: string | null;
  sourceId: string | null;
  occurredAt: Date;
  createdAt: Date;
}

interface CreateManualCashMovementData {
  cashSessionId: string;
  recordedByMembershipId: string;
  movementType: ManualCashMovementType;
  amount: string;
  reason: string;
  reference: string | null;
}

export type {
  CashMovement,
  CashMovementDirection,
  CashMovementEmployee,
  CashMovementType,
  CreateManualCashMovementData,
  ManualCashMovementType,
};
