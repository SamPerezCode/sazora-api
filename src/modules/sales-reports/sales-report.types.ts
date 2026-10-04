import type { OrderServiceType } from "../orders/order.types";

type SalesBusinessContext = Readonly<{
  id: string;
  name: string;
  timezone: string;
  currencyCode: string;
}>;

type SalesPeriod = Readonly<{
  from: string;
  to: string;
  timezone: string;
  start: string;
  end: string;
}>;

type SalesReportFilters = Readonly<{
  period: SalesPeriod;
  serviceType?: OrderServiceType;
  openedByMembershipId?: string;
  page: number;
  pageSize: number;
  topLimit: number;
}>;

type SalesSummaryRecord = Readonly<{
  salesTotal: string;
  orderCount: number;
  unitsSold: number;
  averageTicket: string;
}>;

type SalesByServiceType = Readonly<{
  serviceType: OrderServiceType;
  salesTotal: string;
  orderCount: number;
  unitsSold: number;
}>;

type SalesHistoryItem = Readonly<{
  orderId: string;
  serviceType: OrderServiceType;
  restaurantTableId: string | null;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  openedByMembershipId: string;
  openedByName: string;
  customerCount: number | null;
  itemCount: number;
  unitsSold: number;
  salesTotal: string;
  createdAt: Date;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date;
}>;

type SalesTopProduct = Readonly<{
  productId: string;
  productName: string;
  quantitySold: number;
  orderCount: number;
  salesTotal: string;
}>;

type SalesHistoryResult = Readonly<{
  sales: readonly SalesHistoryItem[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>;
}>;

type SalesReport = Readonly<{
  generatedAt: Date;
  business: SalesBusinessContext;
  period: Readonly<{
    from: string;
    to: string;
    timezone: string;
  }>;
  summary: SalesSummaryRecord;
  byServiceType: readonly SalesByServiceType[];
  topProducts: readonly SalesTopProduct[];
  history: SalesHistoryResult;
  financialSource: "CLOSED_ORDERS";
}>;

export type {
  SalesBusinessContext,
  SalesByServiceType,
  SalesHistoryItem,
  SalesHistoryResult,
  SalesPeriod,
  SalesReport,
  SalesReportFilters,
  SalesSummaryRecord,
  SalesTopProduct,
};
