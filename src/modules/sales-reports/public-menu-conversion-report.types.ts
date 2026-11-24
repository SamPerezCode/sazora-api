import type { PublicOrderRequestServiceType } from "../public-order-requests/public-order-request.types";
import type {
  SalesBusinessContext,
  SalesPeriod,
  SalesReportScope,
} from "./sales-report.types";

type PublicMenuConversionFilters = Readonly<{
  period: SalesPeriod;
  locationId?: string;
  serviceType?: PublicOrderRequestServiceType;
}>;

type PublicMenuConversionCounts = Readonly<{
  receivedRequests: number;
  contactedRequests: number;
  rejectedRequests: number;
  acceptedRequests: number;
  paidOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  createdSales: number;
  completedSales: number;
  voidedSales: number;
  identifiedCustomers: number;
}>;

type PublicMenuConversionRates = Readonly<{
  contactRate: string;
  acceptanceRate: string;
  paymentRate: string;
  confirmationRate: string;
  deliveryRate: string;
  saleRate: string;
}>;

type PublicMenuConversionAmounts = Readonly<{
  grossSalesTotal: string;
  refundedTotal: string;
  effectiveSalesTotal: string;
}>;

type PublicMenuConversionReport = Readonly<{
  generatedAt: Date;
  business: SalesBusinessContext;
  scope: SalesReportScope;

  period: Readonly<{
    from: string;
    to: string;
    timezone: string;
  }>;

  serviceType: PublicOrderRequestServiceType | null;
  counts: PublicMenuConversionCounts;
  rates: PublicMenuConversionRates;
  amounts: PublicMenuConversionAmounts;

  cohortSource: "PUBLIC_ORDER_REQUEST_CREATED_AT";
}>;

export type {
  PublicMenuConversionAmounts,
  PublicMenuConversionCounts,
  PublicMenuConversionFilters,
  PublicMenuConversionRates,
  PublicMenuConversionReport,
};
