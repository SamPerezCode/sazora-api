import type { OrderServiceType, OrderStatus } from "../orders/order.types";

import type {
  SalesBusinessContext,
  SalesPeriod,
  SalesReportScope,
} from "./sales-report.types";

type CancellationEventType = "FULL_ITEM" | "PARTIAL_QUANTITY";

type CancellationReportFilters = Readonly<{
  period: SalesPeriod;

  locationId?: string;
  serviceType?: OrderServiceType;
  cancelledByMembershipId?: string;
  eventType?: CancellationEventType;

  page: number;
  pageSize: number;
}>;

type CancellationSummary = Readonly<{
  cancelledOrderCount: number;

  cancellationEventCount: number;
  affectedOrderCount: number;

  fullyCancelledProductCount: number;
  partialCancellationCount: number;

  cancelledUnitCount: number;
  affectedAmount: string;
}>;

type CancellationHistoryItem = Readonly<{
  eventId: string;
  eventType: CancellationEventType;

  orderId: string;
  orderItemId: string;

  orderStatus: OrderStatus;
  orderIsCancelled: boolean;

  locationId: string;
  locationCode: string;
  locationName: string;

  serviceType: OrderServiceType;

  restaurantTableId: string | null;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;

  productId: string;
  productName: string;

  previousQuantity: number;
  remainingQuantity: number | null;
  cancelledQuantity: number;

  unitPrice: string;
  affectedAmount: string;

  reason: string;

  cancelledByMembershipId: string;
  cancelledByName: string;

  cancelledAt: Date;
}>;

type CancellationHistoryResult = Readonly<{
  cancellations: readonly CancellationHistoryItem[];

  pagination: Readonly<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>;
}>;

type CancellationByLocationRecord = Readonly<{
  locationId: string;
  locationCode: string;
  locationName: string;

  cancelledOrderCount: number;
  cancellationEventCount: number;
  affectedOrderCount: number;
  cancelledUnitCount: number;
  affectedAmount: string;
}>;

type CancellationReport = Readonly<{
  generatedAt: Date;

  business: SalesBusinessContext;
  scope: SalesReportScope;

  period: Readonly<{
    from: string;
    to: string;
    timezone: string;
  }>;

  summary: CancellationSummary;
  byLocation: readonly CancellationByLocationRecord[];
  history: CancellationHistoryResult;

  financialMeaning: "POTENTIAL_GROSS_AMOUNT_NOT_REFUND";
  dataSource: "ORDER_ITEM_CHANGE_LEDGER";
}>;

export type {
  CancellationByLocationRecord,
  CancellationEventType,
  CancellationHistoryItem,
  CancellationHistoryResult,
  CancellationReport,
  CancellationReportFilters,
  CancellationSummary,
};
