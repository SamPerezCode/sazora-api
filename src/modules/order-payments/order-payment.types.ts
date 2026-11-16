import type { PaymentType } from "../payment-methods/payment-method.types";

type OrderPaymentBatchStatus = "VERIFIED" | "CONSUMED" | "REFUNDED" | "VOIDED";

interface OrderPayment {
  id: string;
  businessId: string;
  paymentBatchId: string;
  paymentMethodId: string;
  processedByMembershipId: string;
  cashMovementId: string | null;
  salePaymentId: string | null;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  requiresReference: boolean;
  affectsCash: boolean;
  allowsChange: boolean;
  amount: string;
  tenderedAmount: string;
  changeAmount: string;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
}

interface OrderPaymentBatch {
  id: string;
  businessId: string;
  orderId: string;
  cashSessionId: string;
  verifiedByMembershipId: string;
  saleId: string | null;
  status: OrderPaymentBatchStatus;
  idempotencyKey: string;
  paidTotal: string;
  changeTotal: string;
  verifiedAt: Date;
  consumedAt: Date | null;
  refundedAt: Date | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  payments: OrderPayment[];
}

interface RecordOrderPaymentData {
  cashSessionId: string;
  verifiedByMembershipId: string;
  idempotencyKey: string;
  payments: {
    paymentMethodId: string;
    amount: string;
    tenderedAmount?: string | undefined;
    reference: string | null;
    notes: string | null;
  }[];
}

export type {
  OrderPayment,
  OrderPaymentBatch,
  OrderPaymentBatchStatus,
  RecordOrderPaymentData,
};
