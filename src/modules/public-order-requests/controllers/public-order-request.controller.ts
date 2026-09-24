import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  createPublicOrderRequestSchema,
  publicBusinessSlugParamsSchema,
  publicOrderRequestIdParamsSchema,
  rejectPublicOrderRequestSchema,
  publicOrderTrackingParamsSchema,
} from "../schemas/public-order-request.schema";
import {
  createPublicOrderRequest,
  getPublicOrderRequest,
  listPublicOrderRequests,
} from "../services/public-order-request.service";
import { confirmPublicOrderRequestOrder } from "../services/confirm-public-order-request.service";
import {
  acceptPublicOrderRequest,
  contactPublicOrderRequest,
  rejectPublicOrderRequest,
} from "../services/manage-public-order-request.service";
import {
  closePublicOrderRequestOrder,
  getPublicOrderRequestOrder,
} from "../services/public-order-request-order.service";
import { getPublicOrderTracking } from "../services/get-public-order-tracking.service";

const createPublicOrderRequestController: RequestHandler = async (
  request,
  response,
) => {
  const { businessSlug } = publicBusinessSlugParamsSchema.parse(request.params);

  const input = createPublicOrderRequestSchema.parse(request.body);

  const createdRequest = await createPublicOrderRequest(businessSlug, input);

  response.status(201).json({
    status: "success",
    data: {
      request: {
        publicCode: createdRequest.publicCode,
        status: createdRequest.status,
        serviceType: createdRequest.serviceType,
        subtotal: createdRequest.subtotal,
        createdAt: createdRequest.createdAt,
      },
    },
  });
};

const listPublicOrderRequestsController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const requests = await listPublicOrderRequests(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      requests,
    },
  });
};

const getPublicOrderRequestController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { requestId } = publicOrderRequestIdParamsSchema.parse(request.params);

  const publicOrderRequest = await getPublicOrderRequest(
    request.auth.businessId,
    requestId,
  );

  response.status(200).json({
    status: "success",
    data: {
      request: publicOrderRequest,
    },
  });
};

const contactPublicOrderRequestController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { requestId } = publicOrderRequestIdParamsSchema.parse(request.params);

  const publicOrderRequest = await contactPublicOrderRequest(
    request.auth.businessId,
    request.auth.membershipId,
    requestId,
  );

  response.status(200).json({
    status: "success",
    data: {
      request: publicOrderRequest,
    },
  });
};

const rejectPublicOrderRequestController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { requestId } = publicOrderRequestIdParamsSchema.parse(request.params);

  const { reason } = rejectPublicOrderRequestSchema.parse(request.body);

  const publicOrderRequest = await rejectPublicOrderRequest(
    request.auth.businessId,
    request.auth.membershipId,
    requestId,
    reason,
  );

  response.status(200).json({
    status: "success",
    data: {
      request: publicOrderRequest,
    },
  });
};

const acceptPublicOrderRequestController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { requestId } = publicOrderRequestIdParamsSchema.parse(request.params);

  const result = await acceptPublicOrderRequest(
    request.auth.businessId,
    request.auth.membershipId,
    requestId,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const confirmPublicOrderRequestOrderController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { requestId } = publicOrderRequestIdParamsSchema.parse(request.params);

  const result = await confirmPublicOrderRequestOrder(
    request.auth.businessId,
    request.auth.membershipId,
    requestId,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const getPublicOrderRequestOrderController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { requestId } = publicOrderRequestIdParamsSchema.parse(request.params);

  const result = await getPublicOrderRequestOrder(
    request.auth.businessId,
    requestId,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const closePublicOrderRequestOrderController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { requestId } = publicOrderRequestIdParamsSchema.parse(request.params);

  const result = await closePublicOrderRequestOrder(
    request.auth.businessId,
    request.auth.membershipId,
    requestId,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const getPublicOrderTrackingController: RequestHandler = async (
  request,
  response,
) => {
  const { businessSlug, publicCode } = publicOrderTrackingParamsSchema.parse(
    request.params,
  );

  const tracking = await getPublicOrderTracking(businessSlug, publicCode);

  response.status(200).json({
    status: "success",
    data: {
      tracking,
    },
  });
};

export {
  acceptPublicOrderRequestController,
  closePublicOrderRequestOrderController,
  confirmPublicOrderRequestOrderController,
  contactPublicOrderRequestController,
  createPublicOrderRequestController,
  getPublicOrderRequestController,
  getPublicOrderRequestOrderController,
  listPublicOrderRequestsController,
  rejectPublicOrderRequestController,
  getPublicOrderTrackingController,
};
