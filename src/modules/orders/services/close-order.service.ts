import { AppError } from "../../../shared/errors/app-error";
import { emitOrderStatusUpdated } from "../../../realtime/realtime.events";
import type { OrderDetail } from "../order.types";
import { closeOrder as closeOrderRecord } from "../repositories/close-order.repository";
import { findOrderDetailById } from "../repositories/get-order.repository";

const closeDeliveredOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
): Promise<OrderDetail> => {
  const result = await closeOrderRecord(businessId, membershipId, orderId);

  switch (result.kind) {
    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_DELIVERED":
      throw new AppError(
        "Solo se puede cerrar una orden entregada",
        409,
        "ORDER_NOT_DELIVERED",
      );

    case "CLOSED": {
      const order = await findOrderDetailById(businessId, orderId);

      if (!order) {
        throw new Error("No fue posible recuperar la orden cerrada");
      }

      emitOrderStatusUpdated({
        businessId,
        orderId: order.id,
        previousStatus: "DELIVERED",
        status: "CLOSED",
        changedByMembershipId: membershipId,
        changedAt:
          order.closedAt?.toISOString() ?? order.updatedAt.toISOString(),
      });

      return order;
    }
  }
};

export { closeDeliveredOrder };
