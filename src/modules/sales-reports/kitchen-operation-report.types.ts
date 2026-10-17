import type { KitchenWorkflowMode } from "../kitchen-settings/kitchen-settings.types";
import type { OrderServiceType } from "../orders/order.types";

import type {
  SalesBusinessContext,
  SalesPeriod,
  SalesReportScope,
} from "./sales-report.types";

type KitchenOperationReportFilters = Readonly<{
  period: SalesPeriod;

  locationId?: string;
  preparationAreaId?: string;
  workflowMode?: KitchenWorkflowMode;
  serviceType?: OrderServiceType;
}>;

type KitchenTimingMetric = Readonly<{
  sampleSize: number;
  averageMinutes: number | null;
}>;

type KitchenOperationalMetrics = Readonly<{
  orderCount: number;
  ticketCount: number;
  itemCount: number;

  pendingItemCount: number;
  inPreparationItemCount: number;
  readyItemCount: number;
  deliveredItemCount: number;
  cancelledItemCount: number;

  prepareToOrderItemCount: number;
  readyToServeItemCount: number;

  screenTracking: Readonly<{
    itemCount: number;

    queueTime: KitchenTimingMetric;
    preparationTime: KitchenTimingMetric;
    handoffTime: KitchenTimingMetric;
    totalCycleTime: KitchenTimingMetric;
  }>;

  printOnlyTracking: Readonly<{
    itemCount: number;

    /*
     * Este tiempo no representa la preparación.
     * Solo mide desde la creación de la línea de comanda
     * hasta que la orden fue marcada como entregada.
     */
    confirmationToDeliveryTime: KitchenTimingMetric;
  }>;
}>;

type KitchenMetricsByMode = Readonly<{
  workflowMode: KitchenWorkflowMode;
  metrics: KitchenOperationalMetrics;
}>;

type KitchenMetricsByLocation = Readonly<{
  locationId: string;
  locationCode: string;
  locationName: string;
  modes: readonly KitchenMetricsByMode[];
}>;

type KitchenMetricsByArea = Readonly<{
  preparationAreaId: string;
  preparationAreaName: string;
  modes: readonly KitchenMetricsByMode[];
}>;

type KitchenOperationReport = Readonly<{
  generatedAt: Date;

  business: SalesBusinessContext;
  scope: SalesReportScope;

  period: Readonly<{
    from: string;
    to: string;
    timezone: string;
  }>;

  summary: Readonly<{
    overall: KitchenOperationalMetrics;
    byWorkflowMode: readonly KitchenMetricsByMode[];
  }>;

  byLocation: readonly KitchenMetricsByLocation[];
  byPreparationArea: readonly KitchenMetricsByArea[];

  periodBasis: "KITCHEN_ITEM_CREATED_AT";

  dataLimitations: readonly (
    | "PRINT_ONLY_NO_PREPARATION_TIMESTAMPS"
    | "READY_TO_SERVE_NO_PREPARATION_DURATION"
  )[];
}>;

export type {
  KitchenMetricsByArea,
  KitchenMetricsByLocation,
  KitchenMetricsByMode,
  KitchenOperationalMetrics,
  KitchenOperationReport,
  KitchenOperationReportFilters,
  KitchenTimingMetric,
};
