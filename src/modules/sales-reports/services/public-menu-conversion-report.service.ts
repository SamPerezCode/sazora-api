import { AppError } from "../../../shared/errors/app-error";
import { findLocationById } from "../../locations/repositories/location.repository";
import { findSalesBusinessContext } from "../repositories/sales-report.repository";
import { findPublicMenuConversion } from "../repositories/public-menu-conversion-report.repository";
import type {
  PublicMenuConversionRates,
  PublicMenuConversionReport,
  PublicMenuConversionFilters,
} from "../public-menu-conversion-report.types";
import type { PublicMenuConversionReportQuery } from "../schemas/public-menu-conversion-report.schema";
import { createSalesPeriod } from "../sales-period";
import type { SalesReportScope } from "../sales-report.types";

const calculateRate = (value: number, receivedRequests: number): string => {
  if (receivedRequests === 0) {
    return "0.00";
  }

  return ((value * 100) / receivedRequests).toFixed(2);
};

const resolveScope = async (
  businessId: string,
  locationId: string | undefined,
): Promise<SalesReportScope> => {
  if (locationId === undefined) {
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
      "El informe solamente aplica a puntos de venta",
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

const getPublicMenuConversionReport = async (
  businessId: string,
  query: PublicMenuConversionReportQuery,
): Promise<PublicMenuConversionReport> => {
  const business = await findSalesBusinessContext(businessId);

  if (!business) {
    throw new AppError(
      "El negocio no existe o está inactivo",
      404,
      "BUSINESS_NOT_FOUND",
    );
  }

  const scope = await resolveScope(businessId, query.locationId);

  const period = createSalesPeriod(query.from, query.to, business.timezone);

  const filters: PublicMenuConversionFilters = {
    period,

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
  };

  const result = await findPublicMenuConversion(businessId, filters);

  const rates: PublicMenuConversionRates = {
    contactRate: calculateRate(
      result.counts.contactedRequests,
      result.counts.receivedRequests,
    ),

    acceptanceRate: calculateRate(
      result.counts.acceptedRequests,
      result.counts.receivedRequests,
    ),

    paymentRate: calculateRate(
      result.counts.paidOrders,
      result.counts.receivedRequests,
    ),

    confirmationRate: calculateRate(
      result.counts.confirmedOrders,
      result.counts.receivedRequests,
    ),

    deliveryRate: calculateRate(
      result.counts.deliveredOrders,
      result.counts.receivedRequests,
    ),

    saleRate: calculateRate(
      result.counts.completedSales,
      result.counts.receivedRequests,
    ),
  };

  return {
    generatedAt: new Date(),
    business,
    scope,

    period: {
      from: period.from,
      to: period.to,
      timezone: period.timezone,
    },

    serviceType: query.serviceType ?? null,
    counts: result.counts,
    rates,
    amounts: result.amounts,
    cohortSource: "PUBLIC_ORDER_REQUEST_CREATED_AT",
  };
};

export { getPublicMenuConversionReport };
