import { emitOrderCreated } from "../../../realtime/realtime.events";
import { emitPublicOrderRequestStatusUpdated } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import type { OrderDetail } from "../../orders/order.types";
import type { PublicOrderRequest } from "../public-order-request.types";
import {
  acceptPublicOrderRequestRecord,
  markPublicOrderRequestContacted,
  rejectPublicOrderRequestRecord,
} from "../repositories/public-order-request-action.repository";

type AcceptedPublicOrderRequest = Readonly<{
  request: PublicOrderRequest;
  order: OrderDetail;
}>;

const emitStatusChange = (
  previousStatus: PublicOrderRequest["status"],
  request: PublicOrderRequest,
): void => {
  emitPublicOrderRequestStatusUpdated({
    businessId: request.businessId,
    requestId: request.id,
    publicCode: request.publicCode,
    previousStatus,
    status: request.status,
    handledByMembershipId: request.handledByMembershipId,
    orderId: request.orderId,
    changedAt: request.updatedAt.toISOString(),
  });
};

const contactPublicOrderRequest = async (
  businessId: string,
  membershipId: string,
  requestId: string,
): Promise<PublicOrderRequest> => {
  const result = await markPublicOrderRequestContacted(
    businessId,
    requestId,
    membershipId,
  );

  if (result.kind === "NOT_FOUND") {
    throw new AppError(
      "La solicitud pública no existe",
      404,
      "PUBLIC_ORDER_REQUEST_NOT_FOUND",
    );
  }

  if (result.kind === "NOT_ACTIONABLE") {
    throw new AppError(
      `La solicitud ya se encuentra en estado ${result.currentStatus}`,
      409,
      "PUBLIC_ORDER_REQUEST_NOT_ACTIONABLE",
    );
  }

  emitStatusChange(result.previousStatus, result.request);

  return result.request;
};

const rejectPublicOrderRequest = async (
  businessId: string,
  membershipId: string,
  requestId: string,
  reason: string,
): Promise<PublicOrderRequest> => {
  const result = await rejectPublicOrderRequestRecord(
    businessId,
    requestId,
    membershipId,
    reason,
  );

  if (result.kind === "NOT_FOUND") {
    throw new AppError(
      "La solicitud pública no existe",
      404,
      "PUBLIC_ORDER_REQUEST_NOT_FOUND",
    );
  }

  if (result.kind === "NOT_ACTIONABLE") {
    throw new AppError(
      `La solicitud ya se encuentra en estado ${result.currentStatus}`,
      409,
      "PUBLIC_ORDER_REQUEST_NOT_ACTIONABLE",
    );
  }

  emitStatusChange(result.previousStatus, result.request);

  return result.request;
};

const acceptPublicOrderRequest = async (
  businessId: string,
  membershipId: string,
  requestId: string,
): Promise<AcceptedPublicOrderRequest> => {
  const result = await acceptPublicOrderRequestRecord(
    businessId,
    requestId,
    membershipId,
  );

  if (result.kind === "NOT_FOUND") {
    throw new AppError(
      "La solicitud pública no existe",
      404,
      "PUBLIC_ORDER_REQUEST_NOT_FOUND",
    );
  }

  if (result.kind === "NOT_ACTIONABLE") {
    throw new AppError(
      `La solicitud ya se encuentra en estado ${result.currentStatus}`,
      409,
      "PUBLIC_ORDER_REQUEST_NOT_ACTIONABLE",
    );
  }

  if (result.kind === "PRODUCT_UNAVAILABLE") {
    throw new AppError(
      "Uno de los productos ya no está disponible operativamente",
      409,
      "PUBLIC_ORDER_REQUEST_PRODUCT_UNAVAILABLE",
    );
  }

  emitStatusChange(result.previousStatus, result.request);

  emitOrderCreated({
    businessId,
    orderId: result.order.id,
    restaurantTableId: null,
    openedByMembershipId: result.order.openedByMembershipId,
    serviceType: result.order.serviceType,
    status: "OPEN",
    customerCount: null,
    notes: result.order.notes,
    createdAt: result.order.createdAt.toISOString(),
  });

  return {
    request: result.request,
    order: result.order,
  };
};

export {
  acceptPublicOrderRequest,
  contactPublicOrderRequest,
  rejectPublicOrderRequest,
};

export type { AcceptedPublicOrderRequest };
