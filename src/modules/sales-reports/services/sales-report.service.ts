import { AppError } from "../../../shared/errors/app-error";
import {
  findSalesBusinessContext,
  findSalesByServiceType,
  findSalesHistory,
  findSalesSummary,
  findSalesTopProducts,
} from "../repositories/sales-report.repository";
import { createSalesPeriod } from "../sales-period";
import type { SalesReport, SalesReportFilters } from "../sales-report.types";
import type { SalesReportQuery } from "../schemas/sales-report.schema";

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

  const period = createSalesPeriod(query.from, query.to, business.timezone);

  const filters: SalesReportFilters = {
    period,
    page: query.page,
    pageSize: query.pageSize,
    topLimit: query.topLimit,

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

  const [summary, rawByServiceType, topProducts, history] = await Promise.all([
    findSalesSummary(businessId, filters),
    findSalesByServiceType(businessId, filters),
    findSalesTopProducts(businessId, filters),
    findSalesHistory(businessId, filters),
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

  return {
    generatedAt: new Date(),
    business,
    period: {
      from: period.from,
      to: period.to,
      timezone: period.timezone,
    },
    summary,
    byServiceType,
    topProducts,
    history,
    financialSource: "CLOSED_ORDERS",
  };
};

export { getSalesReport };
