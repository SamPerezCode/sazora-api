import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import type { AuthenticatedSession } from "../../auth/auth.types";
import { assertOrderLocationAccess } from "../../orders/services/order-location-access.service";
import { voidSaleSchema } from "../schemas/void-sale.schema";
import { voidSale } from "../services/void-sale.service";
import {
  createSaleSchema,
  saleIdParamsSchema,
} from "../schemas/create-sale.schema";
import { createSale } from "../services/create-sale.service";
import { getSale } from "../services/get-sale.service";
import { createSaleRefundSchema } from "../schemas/sale-refund.schema";
import { createSaleRefund } from "../services/create-sale-refund.service";

import {
  saleRefundIdParamsSchema,
  saleRefundListParamsSchema,
} from "../schemas/sale-refund.schema";
import { getSaleRefund } from "../services/get-sale-refund.service";
import { getSaleRefunds } from "../services/get-sale-refunds.service";

import { resolveOrderLocationScope } from "../../orders/services/order-location-access.service";
import { listSalesQuerySchema } from "../schemas/list-sales.schema";
import { listSales } from "../services/list-sales.service";

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

const voidSaleController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { saleId } = saleIdParamsSchema.parse(request.params);
  const input = voidSaleSchema.parse(request.body);

  const currentSale = await getSale(auth.businessId, saleId);

  assertSaleLocationAccess(auth, currentSale.locationId);

  const sale = await voidSale(
    auth.businessId,
    auth.membershipId,
    saleId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      sale,
    },
  });
};

const createSaleRefundController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);
  const { saleId } = saleIdParamsSchema.parse(request.params);
  const input = createSaleRefundSchema.parse(request.body);

  const currentSale = await getSale(auth.businessId, saleId);

  assertSaleLocationAccess(auth, currentSale.locationId);

  const result = await createSaleRefund(
    auth.businessId,
    auth.membershipId,
    saleId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      refundId: result.refundId,
      sale: result.sale,
    },
  });
};

const getSaleRefundsController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { saleId } = saleRefundListParamsSchema.parse(request.params);

  const sale = await getSale(auth.businessId, saleId);

  assertSaleLocationAccess(auth, sale.locationId);

  const refunds = await getSaleRefunds(auth.businessId, saleId);

  response.status(200).json({
    status: "success",
    data: {
      refunds,
    },
  });
};

const getSaleRefundController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { saleId, refundId } = saleRefundIdParamsSchema.parse(request.params);

  const sale = await getSale(auth.businessId, saleId);

  assertSaleLocationAccess(auth, sale.locationId);

  const refund = await getSaleRefund(auth.businessId, saleId, refundId);

  response.status(200).json({
    status: "success",
    data: {
      refund,
    },
  });
};

const listSalesController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const query = listSalesQuerySchema.parse(request.query);

  const locationId = resolveOrderLocationScope(auth, query.locationId, false);

  const result = await listSales(auth.businessId, query, locationId);

  response.status(200).json({
    status: "success",
    data: result,
  });
};

export {
  createSaleController,
  createSaleRefundController,
  getSaleController,
  getSaleRefundController,
  getSaleRefundsController,
  listSalesController,
  voidSaleController,
};
