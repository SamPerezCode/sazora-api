import type { OrderSourceChannel } from "../orders/order.types";

type CommercialCustomer = Readonly<{
  id: string;
  businessId: string;
  legalName: string;
  billingEmail: string | null;
  billingPhone: string | null;
  normalizedPhone: string | null;
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

type CommercialCustomerListItem = CommercialCustomer &
  Readonly<{
    orderCount: number;
    saleCount: number;
    grossSalesTotal: string;
    refundedTotal: string;
    effectiveSalesTotal: string;
    firstPurchaseAt: Date | null;
    lastPurchaseAt: Date | null;
  }>;

type CommercialCustomerDetail = CommercialCustomerListItem;

type ListCommercialCustomersFilters = Readonly<{
  search?: string;
  acquisitionSourceChannel?: OrderSourceChannel;
  isActive?: boolean;
  page: number;
  pageSize: number;
}>;

type CommercialCustomerListResult = Readonly<{
  customers: readonly CommercialCustomerListItem[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>;
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
  CommercialCustomerDetail,
  CommercialCustomerListItem,
  CommercialCustomerListResult,
  ListCommercialCustomersFilters,
  ResolveCommercialCustomerData,
  UpsertCommercialCustomerIdentityData,
};
