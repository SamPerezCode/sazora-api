import { findLocationById } from "../../locations/repositories/location.repository";
import { AppError } from "../../../shared/errors/app-error";
import { createDashboardPeriod } from "../dashboard-period";
import type {
  DashboardData,
  DashboardOrderSummary,
  DashboardScope,
} from "../dashboard.types";
import {
  findDashboardBusinessContext,
  findDashboardCriticalInventory,
  findDashboardDeliverySummary,
  findDashboardOrdersInProgress,
  findDashboardOrderSummary,
  findDashboardTopProducts,
  findDashboardWeeklySales,
} from "../repositories/dashboard.repository";
import type { DashboardQuery } from "../schemas/dashboard.schema";

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

const resolveDashboardScope = async (
  businessId: string,
  locationId: string | undefined,
): Promise<DashboardScope> => {
  if (!locationId) {
    return {
      type: "BUSINESS",
      location: null,
    };
  }

  const location = await findLocationById(businessId, locationId);

  if (!location) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  if (!location.isActive) {
    throw new AppError("La ubicación está inactiva", 409, "LOCATION_INACTIVE");
  }

  if (location.locationType !== "POINT_OF_SALE") {
    throw new AppError(
      "El dashboard de ventas solamente aplica a puntos de venta",
      409,
      "LOCATION_NOT_POINT_OF_SALE",
    );
  }

  return {
    type: "LOCATION",
    location: {
      id: location.id,
      code: location.code,
      name: location.name,
    },
  };
};

const getDashboard = async (
  businessId: string,
  query: DashboardQuery,
): Promise<DashboardData> => {
  const [business, scope] = await Promise.all([
    findDashboardBusinessContext(businessId),
    resolveDashboardScope(businessId, query.locationId),
  ]);

  if (!business) {
    throw new AppError(
      "El negocio no existe o está inactivo",
      404,
      "BUSINESS_NOT_FOUND",
    );
  }

  const generatedAt = new Date();

  const period = createDashboardPeriod(business.timezone, generatedAt);

  const locationId = scope.type === "LOCATION" ? scope.location.id : undefined;

  const [
    orderSummary,
    deliverySummary,
    weeklySalesTotals,
    topProducts,
    ordersInProgress,
    criticalInventory,
  ] = await Promise.all([
    findDashboardOrderSummary(businessId, period, locationId),

    findDashboardDeliverySummary(businessId, period, locationId),

    findDashboardWeeklySales(businessId, period, locationId),

    findDashboardTopProducts(businessId, period, locationId),

    findDashboardOrdersInProgress(businessId, locationId),

    /*
     * Temporalmente continúa siendo global.
     * No recibe locationId.
     */
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

  const operationalScope = scope.type === "LOCATION" ? "LOCATION" : "BUSINESS";

  return {
    generatedAt,
    business,
    scope,

    dataScopes: {
      orders: operationalScope,
      deliveries: operationalScope,
      criticalInventory: "BUSINESS",
    },

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
