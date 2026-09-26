import type { DeliveryStatus } from "../deliveries/delivery.types";
import type { InventoryUnit } from "../inventory-items/inventory-item.types";
import type { OrderServiceType, OrderStatus } from "../orders/order.types";

type DashboardWeekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

type DashboardBusinessContext = Readonly<{
  id: string;
  name: string;
  timezone: string;
  currencyCode: string;
}>;

type DashboardDayPeriod = Readonly<{
  date: string;
  dayOfWeek: number;
  weekday: DashboardWeekday;
  start: string;
  end: string;
}>;

type DashboardPeriod = Readonly<{
  timezone: string;
  today: string;
  weekStart: string;
  weekEnd: string;
  yesterdayStart: string;
  todayStart: string;
  tomorrowStart: string;
  days: readonly DashboardDayPeriod[];
}>;

type DashboardSummary = Readonly<{
  todaySales: string;
  yesterdaySales: string;
  salesVariationPercentage: string | null;
  openOrders: number;
  activeDeliveries: number;
  servedCustomers: number;
  closedOrders: number;
  averageTicket: string;
  averageDeliveryMinutes: number | null;
}>;

type DashboardWeeklySale = Readonly<{
  date: string;
  dayOfWeek: number;
  weekday: DashboardWeekday;
  total: string;
}>;

type DashboardWeeklySalesTotal = Readonly<{
  dayIndex: number;
  total: string;
}>;

type DashboardTopProduct = Readonly<{
  productId: string;
  productName: string;
  quantitySold: number;
  salesTotal: string;
}>;

type DashboardOrderInProgress = Readonly<{
  id: string;
  serviceType: OrderServiceType;
  status: OrderStatus;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  customerName: string | null;
  deliveryAddress: string | null;
  itemCount: number;
  subtotal: string;
  createdAt: Date;
}>;

type DashboardCriticalInventoryItem = Readonly<{
  inventoryItemId: string;
  name: string;
  baseUnit: InventoryUnit;
  currentStock: string;
  minimumStock: string;
  stockPercentage: number | null;
}>;

type DashboardDeliverySummary = Readonly<{
  activeDeliveries: number;
  averageDeliveryMinutes: number | null;
}>;

type DashboardOrderSummary = Readonly<{
  todaySales: string;
  yesterdaySales: string;
  openOrders: number;
  servedCustomers: number;
  closedOrders: number;
  averageTicket: string;
}>;

type DashboardData = Readonly<{
  generatedAt: Date;
  business: DashboardBusinessContext;
  period: Readonly<{
    timezone: string;
    today: string;
    weekStart: string;
    weekEnd: string;
  }>;
  summary: DashboardSummary;
  weeklySales: readonly DashboardWeeklySale[];
  topProducts: readonly DashboardTopProduct[];
  ordersInProgress: readonly DashboardOrderInProgress[];
  criticalInventory: readonly DashboardCriticalInventoryItem[];
}>;

type DashboardActiveDeliveryStatus = Exclude<
  DeliveryStatus,
  "DELIVERED" | "CANCELLED"
>;

export type {
  DashboardActiveDeliveryStatus,
  DashboardBusinessContext,
  DashboardCriticalInventoryItem,
  DashboardData,
  DashboardDayPeriod,
  DashboardDeliverySummary,
  DashboardOrderInProgress,
  DashboardOrderSummary,
  DashboardPeriod,
  DashboardSummary,
  DashboardTopProduct,
  DashboardWeekday,
  DashboardWeeklySale,
  DashboardWeeklySalesTotal,
};
