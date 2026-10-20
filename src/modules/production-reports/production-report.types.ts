import type { ProductionOrderStatus } from "../production-orders/production-order.types";

type ProductionReportDateField =
  "CREATED" | "PLANNED" | "STARTED" | "COMPLETED";

type ProductionReportGroupBy = "LOCATION" | "OUTPUT" | "EMPLOYEE";

type ProductionReportPeriod = Readonly<{
  from: string;
  to: string;
  timezone: string;
  start: string;
  end: string;
}>;

type ProductionReportFilters = Readonly<{
  period: ProductionReportPeriod;

  dateField: ProductionReportDateField;

  locationIds: readonly string[] | null;

  outputInventoryItemId?: string | undefined;
  membershipId?: string | undefined;
  status?: ProductionOrderStatus | undefined;
  search?: string | undefined;

  page: number;
  pageSize: number;
}>;

type ProductionReportLocation = Readonly<{
  id: string;
  code: string;
  name: string;
}>;

type ProductionReportRecipe = Readonly<{
  id: string;
  code: string;
  name: string;
}>;

type ProductionReportEmployee = Readonly<{
  membershipId: string;
  name: string;
}>;

type ProductionReportOutput = Readonly<{
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  plannedQuantity: string;
  actualQuantity: string | null;
  baseUnit: string;
}>;

type ProductionReportOrder = Readonly<{
  productionOrderId: string;

  status: ProductionOrderStatus;
  batchQuantity: string;

  recipe: ProductionReportRecipe;
  location: ProductionReportLocation;

  responsible: ProductionReportEmployee;

  outputs: readonly ProductionReportOutput[];

  plannedFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;

  inputCount: number;
  outputCount: number;

  expectedInputCostAtActualRate: string | null;
  actualInputCost: string | null;
  inputCostDifference: string | null;
  inputCostVariationPercentage: string | null;

  declaredWasteCost: string;

  totalResourceCost: string | null;
  producedInventoryValue: string | null;

  performanceAvailable: boolean;
}>;

type ProductionReportSummary = Readonly<{
  orderCount: number;

  draftCount: number;
  plannedCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;

  expectedInputCostAtActualRate: string | null;
  actualInputCost: string | null;
  inputCostDifference: string | null;
  inputCostVariationPercentage: string | null;

  declaredWasteCost: string;
  totalResourceCost: string | null;
  producedInventoryValue: string | null;
}>;

type ProductionReportGroup = Readonly<{
  key: string;
  label: string;

  orderCount: number;
  completedCount: number;

  expectedInputCostAtActualRate: string | null;
  actualInputCost: string | null;
  inputCostDifference: string | null;
  inputCostVariationPercentage: string | null;

  declaredWasteCost: string;
  totalResourceCost: string | null;
  producedInventoryValue: string | null;
}>;

type ProductionReportPagination = Readonly<{
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

type ProductionOrderHistoryResult = Readonly<{
  orders: readonly ProductionReportOrder[];
  pagination: ProductionReportPagination;
}>;

type ProductionGroupedReportResult = Readonly<{
  groupBy: ProductionReportGroupBy;
  groups: readonly ProductionReportGroup[];
}>;

export type {
  ProductionGroupedReportResult,
  ProductionOrderHistoryResult,
  ProductionReportDateField,
  ProductionReportEmployee,
  ProductionReportFilters,
  ProductionReportGroup,
  ProductionReportGroupBy,
  ProductionReportLocation,
  ProductionReportOrder,
  ProductionReportOutput,
  ProductionReportPagination,
  ProductionReportPeriod,
  ProductionReportRecipe,
  ProductionReportSummary,
};
