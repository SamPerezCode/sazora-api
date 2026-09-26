import { AppError } from "../../../shared/errors/app-error";
import { createDashboardPeriod } from "../dashboard-period";
import type { DashboardData, DashboardOrderSummary } from "../dashboard.types";
import {
  findDashboardBusinessContext,
  findDashboardCriticalInventory,
  findDashboardDeliverySummary,
  findDashboardOrdersInProgress,
  findDashboardOrderSummary,
  findDashboardTopProducts,
  findDashboardWeeklySales,
} from "../repositories/dashboard.repository";

const calculateSalesVariation = (
  summary: DashboardOrderSummary,
): string | null => {
  const todaySales = Number(summary.todaySales);
  const yesterdaySales = Number(summary.yesterdaySales);

  if (yesterdaySales === 0) {
    return todaySales === 0 ? "0.00" : null;
  }

  return (((todaySales - yesterdaySales) / yesterdaySales) * 100).toFixed(2);
};

const getDashboard = async (businessId: string): Promise<DashboardData> => {
  const business = await findDashboardBusinessContext(businessId);

  if (!business) {
    throw new AppError(
      "El negocio no existe o está inactivo",
      404,
      "BUSINESS_NOT_FOUND",
    );
  }

  const generatedAt = new Date();

  const period = createDashboardPeriod(business.timezone, generatedAt);

  const [
    orderSummary,
    deliverySummary,
    weeklySalesTotals,
    topProducts,
    ordersInProgress,
    criticalInventory,
  ] = await Promise.all([
    findDashboardOrderSummary(businessId, period),
    findDashboardDeliverySummary(businessId, period),
    findDashboardWeeklySales(businessId, period),
    findDashboardTopProducts(businessId, period),
    findDashboardOrdersInProgress(businessId),
    findDashboardCriticalInventory(businessId),
  ]);

  const weeklySalesByDay = new Map(
    weeklySalesTotals.map((sale) => [sale.dayIndex, sale.total]),
  );

  const weeklySales = period.days.map((day, dayIndex) => ({
    date: day.date,
    dayOfWeek: day.dayOfWeek,
    weekday: day.weekday,
    total: weeklySalesByDay.get(dayIndex) ?? "0.00",
  }));

  return {
    generatedAt,
    business,
    period: {
      timezone: period.timezone,
      today: period.today,
      weekStart: period.weekStart,
      weekEnd: period.weekEnd,
    },
    summary: {
      todaySales: orderSummary.todaySales,
      yesterdaySales: orderSummary.yesterdaySales,
      salesVariationPercentage: calculateSalesVariation(orderSummary),
      openOrders: orderSummary.openOrders,
      activeDeliveries: deliverySummary.activeDeliveries,
      servedCustomers: orderSummary.servedCustomers,
      closedOrders: orderSummary.closedOrders,
      averageTicket: orderSummary.averageTicket,
      averageDeliveryMinutes: deliverySummary.averageDeliveryMinutes,
    },
    weeklySales,
    topProducts,
    ordersInProgress,
    criticalInventory,
  };
};

export { getDashboard };
