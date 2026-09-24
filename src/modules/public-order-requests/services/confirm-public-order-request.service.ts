import { emitPublicOrderRequestOrderConfirmed } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import type { ConfirmOrderOutput } from "../../orders/services/confirm-order.service";
import { confirmOrder } from "../../orders/services/confirm-order.service";
import type { PublicOrderRequest } from "../public-order-request.types";
import { findPublicOrderRequestById } from "../repositories/public-order-request.repository";

type ConfirmPublicOrderRequestOutput = Readonly<{
  request: PublicOrderRequest;
  order: ConfirmOrderOutput["order"];
  kitchenTickets: ConfirmOrderOutput["kitchenTickets"];
}>;

const confirmPublicOrderRequestOrder = async (
  businessId: string,
  membershipId: string,
  requestId: string,
): Promise<ConfirmPublicOrderRequestOutput> => {
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
      "La solicitud debe estar aceptada y tener una orden vinculada",
      409,
      "PUBLIC_ORDER_REQUEST_NOT_ACCEPTED",
    );
  }

  const confirmation = await confirmOrder(
    businessId,
    membershipId,
    publicOrderRequest.orderId,
  );

  try {
    emitPublicOrderRequestOrderConfirmed({
      businessId,
      requestId: publicOrderRequest.id,
      publicCode: publicOrderRequest.publicCode,
      orderId: confirmation.order.id,
      orderStatus: "CONFIRMED",
      serviceType: publicOrderRequest.serviceType,
      confirmedByMembershipId: membershipId,
      confirmedAt: confirmation.order.confirmedAt?.toISOString() ?? null,
      kitchenTickets: confirmation.kitchenTickets,
    });
  } catch (error) {
    console.error(
      "No fue posible emitir la confirmación de la solicitud pública",
      error,
    );
  }

  return {
    request: publicOrderRequest,
    order: confirmation.order,
    kitchenTickets: confirmation.kitchenTickets,
  };
};

export { confirmPublicOrderRequestOrder };
export type { ConfirmPublicOrderRequestOutput };
