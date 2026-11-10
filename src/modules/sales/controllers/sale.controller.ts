import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import type { AuthenticatedSession } from "../../auth/auth.types";
import { assertOrderLocationAccess } from "../../orders/services/order-location-access.service";
import {
  createSaleSchema,
  saleIdParamsSchema,
} from "../schemas/create-sale.schema";
import { createSale } from "../services/create-sale.service";
import { getSale } from "../services/get-sale.service";

const requireAuth = (
  request: Parameters<RequestHandler>[0],
): AuthenticatedSession => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const assertSaleLocationAccess = (
  auth: AuthenticatedSession,
  locationId: string,
): void => {
  if (auth.locationAccess.hasGlobalAccess) {
    return;
  }

  const hasAccess = auth.locationAccess.locations.some(
    (location) => location.id === locationId,
  );

  if (!hasAccess) {
    throw new AppError(
      "No tienes acceso a la ubicación de esta venta",
      403,
      "LOCATION_ACCESS_DENIED",
    );
  }
};

const createSaleController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const input = createSaleSchema.parse(request.body);

  await assertOrderLocationAccess(auth, input.orderId);

  const sale = await createSale(auth.businessId, auth.membershipId, input);

  response.status(201).json({
    status: "success",
    data: {
      sale,
    },
  });
};

const getSaleController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { saleId } = saleIdParamsSchema.parse(request.params);

  const sale = await getSale(auth.businessId, saleId);

  assertSaleLocationAccess(auth, sale.locationId);

  response.status(200).json({
    status: "success",
    data: {
      sale,
    },
  });
};

export { createSaleController, getSaleController };
