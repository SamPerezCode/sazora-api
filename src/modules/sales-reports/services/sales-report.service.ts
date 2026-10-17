import { findLocationById } from "../../locations/repositories/location.repository";
import { AppError } from "../../../shared/errors/app-error";
import {
  findSalesBusinessContext,
  findSalesByLocation,
  findSalesByServiceType,
  findSalesHistory,
  findSalesSummary,
  findSalesTopProducts,
} from "../repositories/sales-report.repository";
import { createSalesPeriod } from "../sales-period";
import type {
  SalesByLocation,
  SalesReport,
  SalesReportFilters,
  SalesReportScope,
} from "../sales-report.types";
import type { SalesReportQuery } from "../schemas/sales-report.schema";

const resolveSalesReportScope = async (
  businessId: string,
  locationId: string | undefined,
): Promise<SalesReportScope> => {
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
      "El informe de ventas solamente aplica a puntos de venta",
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

const calculateLocationPercentages = (
  salesTotal: string,
  records: readonly {
    locationId: string;
    locationCode: string;
    locationName: string;
    salesTotal: string;
    orderCount: number;
    unitsSold: number;
    servedCustomers: number;
    averageTicket: string;
  }[],
): SalesByLocation[] => {
  const total = Number(salesTotal);

  return records.map((record) => ({
    ...record,

    salesPercentage:
      total === 0
        ? "0.00"
        : ((Number(record.salesTotal) / total) * 100).toFixed(2),
  }));
};

const getSalesReport = async (
  businessId: string,
  query: SalesReportQuery,
): Promise<SalesReport> => {
  const business = await findSalesBusinessContext(businessId);

  if (!business) {
    throw new AppError(
      "El negocio no existe o está inactivo",
      404,
      "BUSINESS_NOT_FOUND",
    );
  }

  const scope = await resolveSalesReportScope(businessId, query.locationId);

  const period = createSalesPeriod(query.from, query.to, business.timezone);

  const filters: SalesReportFilters = {
    period,
    page: query.page,
    pageSize: query.pageSize,
    topLimit: query.topLimit,

    ...(scope.type === "LOCATION"
      ? {
          locationId: scope.location.id,
        }
      : {}),

    ...(query.serviceType === undefined
      ? {}
      : {
          serviceType: query.serviceType,
        }),

    ...(query.openedByMembershipId === undefined
      ? {}
      : {
          openedByMembershipId: query.openedByMembershipId,
        }),
  };

  const [summary, rawByServiceType, topProducts, history, rawByLocation] =
    await Promise.all([
      findSalesSummary(businessId, filters),

      findSalesByServiceType(businessId, filters),

      findSalesTopProducts(businessId, filters),

      findSalesHistory(businessId, filters),

      scope.type === "BUSINESS"
        ? findSalesByLocation(businessId, filters)
        : Promise.resolve([]),
    ]);

  const serviceTotalsByType = new Map(
    rawByServiceType.map((item) => [item.serviceType, item]),
  );

  const byServiceType = (["TABLE", "TAKEAWAY", "DELIVERY"] as const).map(
    (serviceType) =>
      serviceTotalsByType.get(serviceType) ?? {
        serviceType,
        salesTotal: "0.00",
        orderCount: 0,
        unitsSold: 0,
      },
  );

  const byLocation =
    scope.type === "BUSINESS"
      ? calculateLocationPercentages(summary.salesTotal, rawByLocation)
      : [];

  return {
    generatedAt: new Date(),
    business,
    scope,

    period: {
      from: period.from,
      to: period.to,
      timezone: period.timezone,
    },

    summary,
    byServiceType,
    byLocation,
    topProducts,
    history,

    financialSource: "CLOSED_ORDERS",
  };
};

export { getSalesReport };
