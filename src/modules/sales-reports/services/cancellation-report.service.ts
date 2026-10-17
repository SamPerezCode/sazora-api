import { findLocationById } from "../../locations/repositories/location.repository";

import { AppError } from "../../../shared/errors/app-error";

import { findSalesBusinessContext } from "../repositories/sales-report.repository";

import {
  findCancellationByLocation,
  findCancellationHistory,
  findCancellationSummary,
} from "../repositories/cancellation-report.repository";

import { createSalesPeriod } from "../sales-period";

import type {
  CancellationReport,
  CancellationReportFilters,
} from "../cancellation-report.types";

import type { SalesReportScope } from "../sales-report.types";

import type { CancellationReportQuery } from "../schemas/cancellation-report.schema";

const resolveCancellationReportScope = async (
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
      "El informe de cancelaciones solamente aplica a puntos de venta",
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

const getCancellationReport = async (
  businessId: string,
  query: CancellationReportQuery,
): Promise<CancellationReport> => {
  const business = await findSalesBusinessContext(businessId);

  if (!business) {
    throw new AppError(
      "El negocio no existe o está inactivo",
      404,
      "BUSINESS_NOT_FOUND",
    );
  }

  const scope = await resolveCancellationReportScope(
    businessId,
    query.locationId,
  );

  const period = createSalesPeriod(query.from, query.to, business.timezone);

  const filters: CancellationReportFilters = {
    period,
    page: query.page,
    pageSize: query.pageSize,

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

    ...(query.cancelledByMembershipId === undefined
      ? {}
      : {
          cancelledByMembershipId: query.cancelledByMembershipId,
        }),

    ...(query.eventType === undefined
      ? {}
      : {
          eventType: query.eventType,
        }),
  };

  const [summary, history, byLocation] = await Promise.all([
    findCancellationSummary(businessId, filters),

    findCancellationHistory(businessId, filters),

    scope.type === "BUSINESS"
      ? findCancellationByLocation(businessId, filters)
      : Promise.resolve([]),
  ]);

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
    byLocation,
    history,

    /*
     * El importe representa el valor bruto de las unidades
     * canceladas. No significa necesariamente que se haya
     * efectuado un reembolso o devolución de dinero.
     */
    financialMeaning: "POTENTIAL_GROSS_AMOUNT_NOT_REFUND",

    /*
     * Los importes proceden del historial inmutable de cambios
     * de productos y no del estado actual de la orden.
     */
    dataSource: "ORDER_ITEM_CHANGE_LEDGER",
  };
};

export { getCancellationReport };
