import { AppError } from "../../../shared/errors/app-error";
import {
  emitKitchenTicketItemStatusUpdated,
  emitOrderStatusUpdated,
} from "../../../realtime/realtime.events";
import type { KitchenTicketItem } from "../kitchen-ticket.types";
import { updateKitchenTicketItemStatus as updateKitchenTicketItemStatusRecord } from "../repositories/update-kitchen-ticket-item-status.repository";
import type { UpdateKitchenTicketItemStatusInput } from "../schemas/update-kitchen-ticket-item-status.schema";

type UpdateKitchenTicketItemStatusOutput = Readonly<{
  orderId: string;
  item: KitchenTicketItem;
  orderDelivered: boolean;
}>;

const changeKitchenTicketItemStatus = async (
  businessId: string,
  membershipId: string,
  kitchenTicketId: string,
  kitchenTicketItemId: string,
  input: UpdateKitchenTicketItemStatusInput,
): Promise<UpdateKitchenTicketItemStatusOutput> => {
  const result = await updateKitchenTicketItemStatusRecord(
    businessId,
    membershipId,
    kitchenTicketId,
    kitchenTicketItemId,
    input.status,
  );

  switch (result.kind) {
    case "UPDATED": {
      emitKitchenTicketItemStatusUpdated({
        businessId,
        orderId: result.orderId,
        kitchenTicketId,
        kitchenTicketItemId: result.item.id,
        preparationStatus: result.item.preparationStatus,
        orderDelivered: result.orderDelivered,
        updatedAt: result.item.updatedAt.toISOString(),
      });

      if (result.orderDelivered) {
        emitOrderStatusUpdated({
          businessId,
          orderId: result.orderId,
          previousStatus: "CONFIRMED",
          status: "DELIVERED",
          changedByMembershipId: membershipId,
          changedAt:
            result.item.deliveredAt?.toISOString() ??
            result.item.updatedAt.toISOString(),
        });
      }

      return {
        orderId: result.orderId,
        item: result.item,
        orderDelivered: result.orderDelivered,
      };
    }

    case "ITEM_NOT_FOUND":
      throw new AppError(
        "El producto no existe dentro de la comanda",
        404,
        "KITCHEN_TICKET_ITEM_NOT_FOUND",
      );

    case "ORDER_NOT_CONFIRMED":
      throw new AppError(
        "La orden no está disponible para preparación",
        409,
        "ORDER_NOT_CONFIRMED",
      );

    case "INVALID_TRANSITION":
      throw new AppError(
        "La transición de preparación no está permitida",
        409,
        "INVALID_KITCHEN_STATUS_TRANSITION",
      );
  }
};

export { changeKitchenTicketItemStatus };

export type { UpdateKitchenTicketItemStatusOutput };
