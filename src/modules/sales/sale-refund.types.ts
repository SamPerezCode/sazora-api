import type { PaymentType } from "../payment-methods/payment-method.types";
import type { Sale } from "./sale.types";

type SaleRefundKind = "PARTIAL" | "FULL";

interface SaleRefundEmployee {
  membershipId: string;
  fullName: string;
}

interface SaleRefundItem {
  id: string;
  businessId: string;
  refundId: string;
  saleItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  restoreInventory: boolean;
  inventoryMovementId: string | null;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  costAmount: string | null;
  createdAt: Date;
}

interface SaleRefundPayment {
  id: string;
  businessId: string;
  refundId: string;
  salePaymentId: string;
  processedByMembershipId: string;
  processedBy: SaleRefundEmployee;
  cashMovementId: string | null;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  requiresReference: boolean;
  affectsCash: boolean;
  amount: string;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
}

interface SaleRefund {
  id: string;
  businessId: string;
  saleId: string;
  cashSessionId: string;
  processedByMembershipId: string;
  processedBy: SaleRefundEmployee;
  refundKind: SaleRefundKind;
  reason: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  costAmount: string | null;
  refundedAt: Date;
  createdAt: Date;
  items: SaleRefundItem[];
  payments: SaleRefundPayment[];
}

interface CreateSaleRefundItemData {
  saleItemId: string;
  quantity: number;
  restoreInventory: boolean;
}

interface CreateSaleRefundPaymentData {
  salePaymentId: string;
  amount: string;
  reference: string | null;
  notes: string | null;
}

interface CreateSaleRefundData {
  cashSessionId: string;
  processedByMembershipId: string;
  reason: string;
  items: CreateSaleRefundItemData[];
  payments: CreateSaleRefundPaymentData[];
}

interface CreatedSaleRefund {
  refund: SaleRefund;
  sale: Sale;
}

export type {
  CreateSaleRefundData,
  CreateSaleRefundItemData,
  CreateSaleRefundPaymentData,
  CreatedSaleRefund,
  SaleRefund,
  SaleRefundEmployee,
  SaleRefundItem,
  SaleRefundKind,
  SaleRefundPayment,
};
