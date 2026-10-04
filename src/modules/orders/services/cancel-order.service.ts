import { emitOrderStatusUpdated } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import type { OrderDetail } from "../order.types";
import { cancelOpenOrder as cancelOpenOrderRecord } from "../repositories/cancel-order.repository";
import type { CancelOrderInput } from "../schemas/cancel-order.schema";
import { getOrder } from "./get-order.service";

type CancelOpenOrderOutput = Readonly<{
  order: OrderDetail;
  cancellation: Readonly<{
    reason: string;
    cancelledByMembershipId: string;
    cancelledItemCount: number;
  }>;
}>;

const cancelOpenOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  input: CancelOrderInput,
): Promise<CancelOpenOrderOutput> => {
  const result = await cancelOpenOrderRecord(
    businessId,
    membershipId,
    orderId,
    input.reason,
  );

  switch (result.kind) {
    case "CANCELLED": {
      const order = await getOrder(businessId, orderId);

      emitOrderStatusUpdated({
        businessId,
        orderId: order.id,
        previousStatus: "OPEN",
        status: "CANCELLED",
        changedByMembershipId: membershipId,
        changedAt:
          order.cancelledAt?.toISOString() ?? order.updatedAt.toISOString(),
      });

      return {
        order,
        cancellation: {
          reason: input.reason,
          cancelledByMembershipId: membershipId,
          cancelledItemCount: result.cancelledItemCount,
        },
      };
    }

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_OPEN":
      throw new AppError(
        "Solo se pueden cancelar órdenes abiertas desde este endpoint",
        409,
        "ORDER_NOT_OPEN",
      );
  }
};

export { cancelOpenOrder };
export type { CancelOpenOrderOutput };
