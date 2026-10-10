import {
  emitInventoryChanged,
  emitOrderItemQuantityCancelled,
} from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import {
  cancelOrderItemQuantity,
  type PartialCancellation,
} from "../repositories/cancel-order-item-quantity.repository";
import type { CancelOrderItemQuantityInput } from "../schemas/cancel-order-item-quantity.schema";

const cancelQuantityFromConfirmedOrderItem = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  orderItemId: string,
  input: CancelOrderItemQuantityInput,
): Promise<PartialCancellation> => {
  const result = await cancelOrderItemQuantity(
    businessId,
    membershipId,
    orderId,
    orderItemId,
    input.quantity,
    input.reason,
  );

  switch (result.kind) {
    case "UPDATED": {
      const { adjustment } = result;

      emitOrderItemQuantityCancelled({
        businessId,
        orderId,
        orderItemId,
        kitchenTicketId: adjustment.kitchenTicketId,
        kitchenTicketItemId: adjustment.kitchenTicketItemId,
        kitchenTicketVersion: adjustment.kitchenTicketVersion,
        previousQuantity: adjustment.previousQuantity,
        cancelledQuantity: adjustment.cancelledQuantity,
        remainingQuantity: adjustment.remainingQuantity,
        preparationStatus: adjustment.preparationStatus,
        cancellationReason: adjustment.cancellationReason,
        cancelledByMembershipId: membershipId,
        adjustedAt: adjustment.adjustedAt.toISOString(),
      });

      if (adjustment.inventoryReversalMovementId !== null) {
        emitInventoryChanged(businessId);
      }

      return adjustment;
    }

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_CONFIRMED":
      throw new AppError(
        "Solo se pueden cancelar unidades de una orden confirmada",
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

    case "INVALID_CANCELLED_QUANTITY":
      throw new AppError(
        `Solo hay ${result.availableQuantity} unidades activas`,
        409,
        "INVALID_CANCELLED_QUANTITY",
      );

    case "FULL_CANCELLATION_REQUIRED":
      throw new AppError(
        "Para retirar todas las unidades utiliza la cancelación completa",
        409,
        "FULL_CANCELLATION_REQUIRED",
      );
  }
};

export { cancelQuantityFromConfirmedOrderItem };
