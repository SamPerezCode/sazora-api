import { AppError } from "../../../shared/errors/app-error";
import type { OrderDetail } from "../../orders/order.types";
import { closeDeliveredOrder } from "../../orders/services/close-order.service";
import { getOrder } from "../../orders/services/get-order.service";
import type { PublicOrderRequest } from "../public-order-request.types";
import { findPublicOrderRequestById } from "../repositories/public-order-request.repository";
import { emitPublicOrderRequestOrderClosed } from "../../../realtime/realtime.events";

type PublicOrderRequestOrderOutput = Readonly<{
  request: PublicOrderRequest;
  order: OrderDetail;
}>;

const getRequestWithLinkedOrder = async (
  businessId: string,
  requestId: string,
): Promise<PublicOrderRequestOrderOutput> => {
  const publicOrderRequest = await findPublicOrderRequestById(
    businessId,
    requestId,
  );

  if (!publicOrderRequest) {
    throw new AppError(
      "La solicitud pública no existe",
      404,
      "PUBLIC_ORDER_REQUEST_NOT_FOUND",
    );
  }

  if (publicOrderRequest.status !== "ACCEPTED" || !publicOrderRequest.orderId) {
    throw new AppError(
      "La solicitud pública todavía no tiene una orden vinculada",
      409,
      "PUBLIC_ORDER_REQUEST_WITHOUT_ORDER",
    );
  }

  const order = await getOrder(businessId, publicOrderRequest.orderId);

  return {
    request: publicOrderRequest,
    order,
  };
};

const getPublicOrderRequestOrder = async (
  businessId: string,
  requestId: string,
): Promise<PublicOrderRequestOrderOutput> =>
  getRequestWithLinkedOrder(businessId, requestId);

const closePublicOrderRequestOrder = async (
  businessId: string,
  membershipId: string,
  requestId: string,
): Promise<PublicOrderRequestOrderOutput> => {
  const result = await getRequestWithLinkedOrder(businessId, requestId);

  const order = await closeDeliveredOrder(
    businessId,
    membershipId,
    result.order.id,
  );

  try {
    emitPublicOrderRequestOrderClosed({
      businessId,
      requestId: result.request.id,
      publicCode: result.request.publicCode,
      orderId: order.id,
      serviceType: result.request.serviceType,
      orderStatus: "CLOSED",
      closedByMembershipId: membershipId,
      closedAt: order.closedAt?.toISOString() ?? order.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("No fue posible emitir el cierre de la orden pública", error);
  }

  return {
    request: result.request,
    order,
  };
};

export { closePublicOrderRequestOrder, getPublicOrderRequestOrder };

export type { PublicOrderRequestOrderOutput };
