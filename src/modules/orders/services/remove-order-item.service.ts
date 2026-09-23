import { emitOrderItemRemoved } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import { removeOrderItem as removeOrderItemRecord } from "../repositories/remove-order-item.repository";

const removeItemFromOrder = async (
  businessId: string,
  orderId: string,
  orderItemId: string,
): Promise<void> => {
  const result = await removeOrderItemRecord(businessId, orderId, orderItemId);

  switch (result.kind) {
    case "REMOVED":
      emitOrderItemRemoved({
        businessId,
        orderId,
        orderItemId,
        removedAt: new Date().toISOString(),
      });

      return;

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_OPEN":
      throw new AppError(
        "Solo se pueden retirar productos de una orden abierta",
        409,
        "ORDER_NOT_OPEN",
      );

    case "ORDER_ITEM_NOT_FOUND":
      throw new AppError(
        "El producto no existe dentro de la orden",
        404,
        "ORDER_ITEM_NOT_FOUND",
      );
  }
};

export { removeItemFromOrder };
