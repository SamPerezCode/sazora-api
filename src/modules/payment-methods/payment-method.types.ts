type PaymentType =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "DIGITAL_WALLET"
  | "VOUCHER"
  | "STORE_CREDIT"
  | "OTHER";

interface PaymentMethod {
  id: string;
  businessId: string;
  code: string;
  name: string;
  paymentType: PaymentType;
  requiresReference: boolean;
  affectsCash: boolean;
  allowsChange: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreatePaymentMethodData {
  code: string;
  name: string;
  paymentType: PaymentType;
  requiresReference: boolean;
  affectsCash: boolean;
  allowsChange: boolean;
  displayOrder: number;
}

type UpdatePaymentMethodData = CreatePaymentMethodData;

export type {
  CreatePaymentMethodData,
  PaymentMethod,
  PaymentType,
  UpdatePaymentMethodData,
};
