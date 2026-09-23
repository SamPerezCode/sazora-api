import { AppError } from "../../../shared/errors/app-error";
import {
  emitOrderItemCancelled,
  emitOrderStatusUpdated,
} from "../../../realtime/realtime.events";
import {
  cancelOrderItem as cancelOrderItemRecord,
  type CancelledOrderItem,
} from "../repositories/cancel-order-item.repository";
import type { CancelOrderItemInput } from "../schemas/cancel-order-item.schema";

const cancelItemFromConfirmedOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  orderItemId: string,
  input: CancelOrderItemInput,
): Promise<CancelledOrderItem> => {
  const result = await cancelOrderItemRecord(
    businessId,
    membershipId,
    orderId,
    orderItemId,
    input.reason,
  );

  switch (result.kind) {
    case "CANCELLED": {
      const { cancellation } = result;

      emitOrderItemCancelled({
        businessId,
        orderId,
        orderItemId: cancellation.orderItemId,
        kitchenTicketId: cancellation.kitchenTicketId,
        kitchenTicketItemId: cancellation.kitchenTicketItemId,
        kitchenTicketVersion: cancellation.kitchenTicketVersion,
        preparationStatus: "CANCELLED",
        orderStatus: cancellation.orderStatus,
        cancellationReason: cancellation.cancellationReason,
        cancelledByMembershipId: membershipId,
        cancelledAt: cancellation.cancelledAt.toISOString(),
      });

      if (cancellation.orderStatus !== "CONFIRMED") {
        emitOrderStatusUpdated({
          businessId,
          orderId,
          previousStatus: "CONFIRMED",
          status: cancellation.orderStatus,
          changedByMembershipId: membershipId,
          changedAt: cancellation.cancelledAt.toISOString(),
        });
      }

      return result.cancellation;
    }

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_CONFIRMED":
      throw new AppError(
        "Solo se pueden cancelar productos de una orden confirmada",
        409,
        "ORDER_NOT_CONFIRMED",
      );

    case "ORDER_ITEM_NOT_FOUND":
      throw new AppError(
        "El producto no existe dentro de la orden",
        404,
        "ORDER_ITEM_NOT_FOUND",
      );

    case "ORDER_ITEM_NOT_CANCELLABLE":
      throw new AppError(
        "El producto ya fue entregado o cancelado",
        409,
        "ORDER_ITEM_NOT_CANCELLABLE",
      );
  }
};

export { cancelItemFromConfirmedOrder };
