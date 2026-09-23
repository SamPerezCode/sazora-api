import {
  emitKitchenTicketItemStatusUpdated,
  emitOrderStatusUpdated,
} from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import type { KitchenTicketItem } from "../kitchen-ticket.types";
import { updateKitchenTicketStatus as updateKitchenTicketStatusRecord } from "../repositories/update-kitchen-ticket-status.repository";
import type { UpdateKitchenTicketStatusInput } from "../schemas/update-kitchen-ticket-status.schema";

type UpdateKitchenTicketStatusOutput = Readonly<{
  orderId: string;
  items: readonly KitchenTicketItem[];
  orderDelivered: boolean;
}>;

const changeKitchenTicketStatus = async (
  businessId: string,
  membershipId: string,
  kitchenTicketId: string,
  input: UpdateKitchenTicketStatusInput,
): Promise<UpdateKitchenTicketStatusOutput> => {
  const result = await updateKitchenTicketStatusRecord(
    businessId,
    membershipId,
    kitchenTicketId,
    input.status,
  );

  switch (result.kind) {
    case "UPDATED": {
      for (const item of result.items) {
        emitKitchenTicketItemStatusUpdated({
          businessId,
          orderId: result.orderId,
          kitchenTicketId,
          kitchenTicketItemId: item.id,
          preparationStatus: item.preparationStatus,
          orderDelivered: result.orderDelivered,
          updatedAt: item.updatedAt.toISOString(),
        });
      }

      if (result.orderDelivered && result.orderDeliveredAt) {
        emitOrderStatusUpdated({
          businessId,
          orderId: result.orderId,
          previousStatus: "CONFIRMED",
          status: "DELIVERED",
          changedByMembershipId: membershipId,
          changedAt: result.orderDeliveredAt.toISOString(),
        });
      }

      return {
        orderId: result.orderId,
        items: result.items,
        orderDelivered: result.orderDelivered,
      };
    }

    case "TICKET_NOT_FOUND":
      throw new AppError(
        "La comanda no existe en este negocio",
        404,
        "KITCHEN_TICKET_NOT_FOUND",
      );

    case "ORDER_NOT_CONFIRMED":
      throw new AppError(
        "La orden no está disponible para preparación",
        409,
        "ORDER_NOT_CONFIRMED",
      );

    case "INVALID_TRANSITION":
      throw new AppError(
        "La comanda no puede avanzar al estado solicitado",
        409,
        "INVALID_KITCHEN_TICKET_STATUS_TRANSITION",
      );
  }
};

export { changeKitchenTicketStatus };

export type { UpdateKitchenTicketStatusOutput };
