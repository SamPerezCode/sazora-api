import {
  emitInventoryChanged,
  emitOrderItemCancelled,
  emitOrderStatusUpdated,
} from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import type { OrderDetail } from "../order.types";
import {
  cancelOrder as cancelOrderRecord,
  type CancelledConfirmedItem,
} from "../repositories/cancel-order.repository";
import type { CancelOrderInput } from "../schemas/cancel-order.schema";
import { getOrder } from "./get-order.service";

type CancelledOrderItemOutput = Readonly<{
  orderItemId: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  kitchenTicketVersion: number;
  previousPreparationStatus: CancelledConfirmedItem["previousPreparationStatus"];
  preparationStatus: "CANCELLED";
  inventoryReversalMovementId: string | null;
  cancelledAt: string;
}>;

type CancelOrderOutput = Readonly<{
  order: OrderDetail;
  cancellation: Readonly<{
    reason: string;
    previousStatus: "OPEN" | "CONFIRMED";
    status: "CANCELLED";
    cancelledByMembershipId: string;
    cancelledItemCount: number;
    cancelledItems: readonly CancelledOrderItemOutput[];
  }>;
}>;

const cancelOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  input: CancelOrderInput,
): Promise<CancelOrderOutput> => {
  const result = await cancelOrderRecord(
    businessId,
    membershipId,
    orderId,
    input.reason,
  );

  switch (result.kind) {
    case "CANCELLED": {
      const order = await getOrder(businessId, orderId);

      const cancelledItems = result.cancelledItems.map((cancelledItem) => ({
        orderItemId: cancelledItem.orderItemId,
        kitchenTicketId: cancelledItem.kitchenTicketId,
        kitchenTicketItemId: cancelledItem.kitchenTicketItemId,
        kitchenTicketVersion: cancelledItem.kitchenTicketVersion,
        previousPreparationStatus: cancelledItem.previousPreparationStatus,
        preparationStatus: "CANCELLED" as const,
        inventoryReversalMovementId: cancelledItem.inventoryReversalMovementId,
        cancelledAt: cancelledItem.cancelledAt.toISOString(),
      }));

      for (const cancelledItem of cancelledItems) {
        emitOrderItemCancelled({
          businessId,
          orderId,
          orderItemId: cancelledItem.orderItemId,
          kitchenTicketId: cancelledItem.kitchenTicketId,
          kitchenTicketItemId: cancelledItem.kitchenTicketItemId,
          kitchenTicketVersion: cancelledItem.kitchenTicketVersion,
          preparationStatus: "CANCELLED",
          orderStatus: "CANCELLED",
          cancellationReason: input.reason,
          cancelledByMembershipId: membershipId,
          cancelledAt: cancelledItem.cancelledAt,
        });
      }

      const changedAt =
        order.cancelledAt?.toISOString() ?? order.updatedAt.toISOString();

      emitOrderStatusUpdated({
        businessId,
        orderId: order.id,
        previousStatus: result.previousStatus,
        status: "CANCELLED",
        changedByMembershipId: membershipId,
        changedAt,
      });

      if (
        cancelledItems.some((item) => item.inventoryReversalMovementId !== null)
      ) {
        emitInventoryChanged(businessId);
      }

      return {
        order,
        cancellation: {
          reason: input.reason,
          previousStatus: result.previousStatus,
          status: "CANCELLED",
          cancelledByMembershipId: membershipId,
          cancelledItemCount: result.cancelledItemCount,
          cancelledItems,
        },
      };
    }

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_CANCELLABLE":
      throw new AppError(
        `No se puede cancelar una orden en estado ${result.currentStatus}`,
        409,
        "ORDER_NOT_CANCELLABLE",
      );

    case "ORDER_HAS_DELIVERED_ITEMS":
      throw new AppError(
        "No se puede cancelar completamente una orden que ya tiene productos entregados",
        409,
        "ORDER_HAS_DELIVERED_ITEMS",
      );
  }
};

export { cancelOrder };

export type { CancelOrderOutput };
