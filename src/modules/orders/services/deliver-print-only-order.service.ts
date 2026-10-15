import {
  emitKitchenTicketItemStatusUpdated,
  emitOrderStatusUpdated,
} from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import { emitPublicOrderRequestPreparationUpdates } from "../../public-order-requests/services/emit-public-order-request-preparation.service";
import type { OrderDetail } from "../order.types";
import { deliverPrintOnlyOrder as deliverPrintOnlyOrderRecord } from "../repositories/deliver-print-only-order.repository";
import { getOrder } from "./get-order.service";

type DeliverPrintOnlyOrderOutput = Readonly<{
  order: OrderDetail;
  delivery: Readonly<{
    deliveredItemCount: number;
    deliveredAt: string;
  }>;
}>;

const deliverOrderWithoutKitchenScreen = async (
  businessId: string,
  membershipId: string,
  orderId: string,
): Promise<DeliverPrintOnlyOrderOutput> => {
  const result = await deliverPrintOnlyOrderRecord(
    businessId,
    membershipId,
    orderId,
  );

  switch (result.kind) {
    case "DELIVERED": {
      const updatedAt = result.deliveredAt.toISOString();

      for (const item of result.items) {
        emitKitchenTicketItemStatusUpdated({
          businessId,
          orderId,
          kitchenTicketId: item.kitchenTicketId,
          kitchenTicketItemId: item.kitchenTicketItemId,
          preparationStatus: "DELIVERED",
          orderDelivered: true,
          updatedAt,
        });
      }

      emitOrderStatusUpdated({
        businessId,
        orderId,
        previousStatus: "CONFIRMED",
        status: "DELIVERED",
        changedByMembershipId: membershipId,
        changedAt: updatedAt,
      });

      if (result.items.length > 0) {
        await emitPublicOrderRequestPreparationUpdates({
          businessId,
          orderId,
          updates: result.items.map((item) => ({
            kitchenTicketId: item.kitchenTicketId,
            kitchenTicketItemId: item.kitchenTicketItemId,
            preparationStatus: "DELIVERED",
            orderDelivered: true,
            updatedAt,
          })),
        });
      }

      const order = await getOrder(businessId, orderId);

      return {
        order,
        delivery: {
          deliveredItemCount: result.items.length,
          deliveredAt: updatedAt,
        },
      };
    }

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_CONFIRMED":
      throw new AppError(
        `No se puede entregar una orden en estado ${result.currentStatus}`,
        409,
        "ORDER_NOT_CONFIRMED",
      );

    case "ORDER_REQUIRES_KITCHEN_SCREEN":
      throw new AppError(
        "Esta orden debe completar su proceso desde la pantalla de cocina",
        409,
        "ORDER_REQUIRES_KITCHEN_SCREEN",
      );

    case "ORDER_HAS_NO_DELIVERABLE_ITEMS":
      throw new AppError(
        "La orden no tiene productos activos para entregar",
        409,
        "ORDER_HAS_NO_DELIVERABLE_ITEMS",
      );
  }
};

export { deliverOrderWithoutKitchenScreen };
export type { DeliverPrintOnlyOrderOutput };
