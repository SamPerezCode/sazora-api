import type { PaymentType } from "../payment-methods/payment-method.types";
import type { CashSession } from "./cash-session.types";

interface CashMovementReconciliation {
  openingCashAmount: string;
  manualIncomeAmount: string;
  cashSaleAmount: string;
  withdrawalAmount: string;
  expenseAmount: string;
  cashRefundAmount: string;
  adjustmentInAmount: string;
  adjustmentOutAmount: string;
  movementNetAmount: string;
  calculatedExpectedCashAmount: string;
}

interface PaymentMethodReconciliation {
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  receivedAmount: string;
  voidedAmount: string;
  refundedAmount: string;
  netAmount: string;
}

interface CommercialReconciliation {
  grossSaleCount: number;
  voidedSaleCount: number;
  refundCount: number;
  grossSaleAmount: string;
  voidedSaleAmount: string;
  refundedAmount: string;
  netCommercialAmount: string;
}

interface CashSessionReconciliation {
  cashSession: CashSession;
  movements: CashMovementReconciliation;
  commercial: CommercialReconciliation;
  paymentMethods: PaymentMethodReconciliation[];
}

interface CashSessionReconciliationData {
  movements: CashMovementReconciliation;
  commercial: CommercialReconciliation;
  paymentMethods: PaymentMethodReconciliation[];
}

export type {
  CashMovementReconciliation,
  CashSessionReconciliation,
  CashSessionReconciliationData,
  CommercialReconciliation,
  PaymentMethodReconciliation,
};
