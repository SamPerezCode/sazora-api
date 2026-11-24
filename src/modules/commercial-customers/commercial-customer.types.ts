import type { OrderSourceChannel } from "../orders/order.types";

type CommercialCustomer = Readonly<{
  id: string;
  businessId: string;
  legalName: string;
  billingEmail: string | null;
  billingPhone: string | null;
  normalizedPhone: string;
  acquisitionSourceChannel: OrderSourceChannel | null;
  lastSourceChannel: OrderSourceChannel | null;
  marketingConsent: boolean;
  marketingConsentAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type ResolveCommercialCustomerData = Readonly<{
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  sourceChannel: OrderSourceChannel;
  marketingConsent?: boolean;
}>;

type UpsertCommercialCustomerIdentityData = Readonly<{
  legalName: string;
  billingEmail: string | null;
  billingPhone: string;
  normalizedPhone: string;
  sourceChannel: OrderSourceChannel;
  marketingConsent: boolean | null;
}>;

export type {
  CommercialCustomer,
  ResolveCommercialCustomerData,
  UpsertCommercialCustomerIdentityData,
};
