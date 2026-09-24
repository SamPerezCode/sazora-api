import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  assignDeliverySchema,
  deliveryIdParamsSchema,
  publicOrderRequestDeliveryParamsSchema,
} from "../schemas/delivery.schema";
import {
  configureDelivery,
  deliverDelivery,
  getDelivery,
  listDeliveries,
  pickUpDelivery,
  startDelivery,
} from "../services/delivery.service";

const requireAuth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const listDeliveriesController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);

  const deliveries = await listDeliveries(
    auth.businessId,
    auth.membershipId,
    auth.roles,
  );

  response.status(200).json({
    status: "success",
    data: { deliveries },
  });
};

const getDeliveryController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { deliveryId } = deliveryIdParamsSchema.parse(request.params);

  const delivery = await getDelivery(
    auth.businessId,
    auth.membershipId,
    auth.roles,
    deliveryId,
  );

  response.status(200).json({
    status: "success",
    data: { delivery },
  });
};

const configureDeliveryController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { requestId } = publicOrderRequestDeliveryParamsSchema.parse(
    request.params,
  );

  const input = assignDeliverySchema.parse(request.body);

  const driverMembershipId =
    input.deliveryMode === "INTERNAL" ? input.driverMembershipId : null;

  const externalProviderName =
    input.deliveryMode === "EXTERNAL" ? input.externalProviderName : null;

  const delivery = await configureDelivery(
    auth.businessId,
    auth.membershipId,
    requestId,
    input.deliveryMode,
    driverMembershipId,
    externalProviderName,
  );

  response.status(200).json({
    status: "success",
    data: { delivery },
  });
};

const pickUpDeliveryController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { deliveryId } = deliveryIdParamsSchema.parse(request.params);

  const delivery = await pickUpDelivery(
    auth.businessId,
    auth.membershipId,
    auth.roles,
    deliveryId,
  );

  response.status(200).json({
    status: "success",
    data: { delivery },
  });
};

const startDeliveryController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { deliveryId } = deliveryIdParamsSchema.parse(request.params);

  const delivery = await startDelivery(
    auth.businessId,
    auth.membershipId,
    auth.roles,
    deliveryId,
  );

  response.status(200).json({
    status: "success",
    data: { delivery },
  });
};

const deliverDeliveryController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const { deliveryId } = deliveryIdParamsSchema.parse(request.params);

  const delivery = await deliverDelivery(
    auth.businessId,
    auth.membershipId,
    auth.roles,
    deliveryId,
  );

  response.status(200).json({
    status: "success",
    data: { delivery },
  });
};

export {
  configureDeliveryController,
  deliverDeliveryController,
  getDeliveryController,
  listDeliveriesController,
  pickUpDeliveryController,
  startDeliveryController,
};
