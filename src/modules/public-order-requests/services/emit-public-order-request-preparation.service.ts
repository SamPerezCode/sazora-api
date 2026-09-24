import { emitPublicOrderRequestPreparationUpdated } from "../../../realtime/realtime.events";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import { findPublicOrderRequestContextByOrderId } from "../repositories/public-order-request.repository";

interface PublicOrderPreparationItemUpdate {
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus: KitchenPreparationStatus;
  orderDelivered: boolean;
  updatedAt: string;
}

interface EmitPublicOrderPreparationUpdatesInput {
  businessId: string;
  orderId: string;
  updates: readonly PublicOrderPreparationItemUpdate[];
}

const emitPublicOrderRequestPreparationUpdates = async (
  input: EmitPublicOrderPreparationUpdatesInput,
): Promise<void> => {
  try {
    const context = await findPublicOrderRequestContextByOrderId(
      input.businessId,
      input.orderId,
    );

    if (!context) {
      return;
    }

    for (const update of input.updates) {
      emitPublicOrderRequestPreparationUpdated({
        businessId: input.businessId,
        requestId: context.requestId,
        publicCode: context.publicCode,
        orderId: input.orderId,
        serviceType: context.serviceType,
        kitchenTicketId: update.kitchenTicketId,
        kitchenTicketItemId: update.kitchenTicketItemId,
        preparationStatus: update.preparationStatus,
        orderStatus: update.orderDelivered ? "DELIVERED" : "CONFIRMED",
        orderDelivered: update.orderDelivered,
        updatedAt: update.updatedAt,
      });
    }
  } catch (error) {
    console.error(
      "No fue posible emitir el avance de la solicitud pública",
      error,
    );
  }
};

export { emitPublicOrderRequestPreparationUpdates };

export type {
  EmitPublicOrderPreparationUpdatesInput,
  PublicOrderPreparationItemUpdate,
};
