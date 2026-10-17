import { findLocationById } from "../../locations/repositories/location.repository";

import { findPreparationAreaById } from "../../preparation-areas/repositories/preparation-area.repository";

import { AppError } from "../../../shared/errors/app-error";

import {
  findKitchenMetricsByArea,
  findKitchenMetricsByLocation,
  findKitchenMetricsByWorkflow,
  findOverallKitchenMetrics,
} from "../repositories/kitchen-operation-report.repository";

import { findSalesBusinessContext } from "../repositories/sales-report.repository";

import { createSalesPeriod } from "../sales-period";

import type {
  KitchenMetricsByArea,
  KitchenMetricsByLocation,
  KitchenMetricsByMode,
  KitchenOperationReport,
  KitchenOperationReportFilters,
} from "../kitchen-operation-report.types";

import type { SalesReportScope } from "../sales-report.types";

import type { KitchenOperationReportQuery } from "../schemas/kitchen-operation-report.schema";

const resolveScope = async (
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
      "El informe de cocina solamente aplica a puntos de venta",
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

const validatePreparationArea = async (
  businessId: string,
  preparationAreaId: string | undefined,
  locationId: string | undefined,
): Promise<void> => {
  if (!preparationAreaId) {
    return;
  }

  const area = await findPreparationAreaById(
    businessId,
    preparationAreaId,
    locationId,
  );

  if (!area) {
    throw new AppError(
      locationId
        ? "El área no pertenece al punto de venta seleccionado"
        : "El área de preparación no existe",
      404,
      "PREPARATION_AREA_NOT_FOUND",
    );
  }
};

const requireWorkflowMode = (
  value: string | null,
): "PRINT_ONLY" | "PRINT_AND_SCREEN" => {
  if (value !== "PRINT_ONLY" && value !== "PRINT_AND_SCREEN") {
    throw new Error(
      "El registro operativo no contiene un modo de cocina válido",
    );
  }

  return value;
};

const groupByLocation = (
  records: Awaited<ReturnType<typeof findKitchenMetricsByLocation>>,
): KitchenMetricsByLocation[] => {
  const locations = new Map<
    string,
    {
      locationId: string;
      locationCode: string;
      locationName: string;
      modes: KitchenMetricsByMode[];
    }
  >();

  for (const record of records) {
    if (!record.locationId || !record.locationCode || !record.locationName) {
      throw new Error("El informe contiene una ubicación incompleta");
    }

    const current = locations.get(record.locationId) ?? {
      locationId: record.locationId,
      locationCode: record.locationCode,
      locationName: record.locationName,
      modes: [],
    };

    current.modes.push({
      workflowMode: requireWorkflowMode(record.workflowMode),
      metrics: record.metrics,
    });

    locations.set(record.locationId, current);
  }

  return [...locations.values()];
};

const groupByPreparationArea = (
  records: Awaited<ReturnType<typeof findKitchenMetricsByArea>>,
): KitchenMetricsByArea[] => {
  const areas = new Map<
    string,
    {
      preparationAreaId: string;
      preparationAreaName: string;
      modes: KitchenMetricsByMode[];
    }
  >();

  for (const record of records) {
    if (!record.preparationAreaId || !record.preparationAreaName) {
      throw new Error("El informe contiene un área de preparación incompleta");
    }

    const current = areas.get(record.preparationAreaId) ?? {
      preparationAreaId: record.preparationAreaId,
      preparationAreaName: record.preparationAreaName,
      modes: [],
    };

    current.modes.push({
      workflowMode: requireWorkflowMode(record.workflowMode),
      metrics: record.metrics,
    });

    areas.set(record.preparationAreaId, current);
  }

  return [...areas.values()];
};

const getKitchenOperationReport = async (
  businessId: string,
  query: KitchenOperationReportQuery,
): Promise<KitchenOperationReport> => {
  const business = await findSalesBusinessContext(businessId);

  if (!business) {
    throw new AppError(
      "El negocio no existe o está inactivo",
      404,
      "BUSINESS_NOT_FOUND",
    );
  }

  const scope = await resolveScope(businessId, query.locationId);

  await validatePreparationArea(
    businessId,
    query.preparationAreaId,
    scope.type === "LOCATION" ? scope.location.id : undefined,
  );

  const period = createSalesPeriod(query.from, query.to, business.timezone);

  const filters: KitchenOperationReportFilters = {
    period,

    ...(scope.type === "LOCATION"
      ? {
          locationId: scope.location.id,
        }
      : {}),

    ...(query.preparationAreaId === undefined
      ? {}
      : {
          preparationAreaId: query.preparationAreaId,
        }),

    ...(query.workflowMode === undefined
      ? {}
      : {
          workflowMode: query.workflowMode,
        }),

    ...(query.serviceType === undefined
      ? {}
      : {
          serviceType: query.serviceType,
        }),
  };

  const [overall, workflowRecords, locationRecords, areaRecords] =
    await Promise.all([
      findOverallKitchenMetrics(businessId, filters),

      findKitchenMetricsByWorkflow(businessId, filters),

      scope.type === "BUSINESS"
        ? findKitchenMetricsByLocation(businessId, filters)
        : Promise.resolve([]),

      findKitchenMetricsByArea(businessId, filters),
    ]);

  const byWorkflowMode: KitchenMetricsByMode[] = workflowRecords.map(
    (record) => ({
      workflowMode: requireWorkflowMode(record.workflowMode),
      metrics: record.metrics,
    }),
  );

  return {
    generatedAt: new Date(),

    business,
    scope,

    period: {
      from: period.from,
      to: period.to,
      timezone: period.timezone,
    },

    summary: {
      overall,
      byWorkflowMode,
    },

    byLocation: groupByLocation(locationRecords),

    byPreparationArea: groupByPreparationArea(areaRecords),

    periodBasis: "KITCHEN_ITEM_CREATED_AT",

    dataLimitations: [
      "PRINT_ONLY_NO_PREPARATION_TIMESTAMPS",
      "READY_TO_SERVE_NO_PREPARATION_DURATION",
    ],
  };
};

export { getKitchenOperationReport };
