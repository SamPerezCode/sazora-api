import { AppError } from "../../../shared/errors/app-error";
import type { OrderItemDetail, UpdateOrderItemData } from "../order.types";
import { updateOrderItem as updateOrderItemRecord } from "../repositories/update-order-item.repository";
import type { UpdateOrderItemInput } from "../schemas/update-order-item.schema";

const updateItemInOrder = async (
  businessId: string,
  orderId: string,
  orderItemId: string,
  input: UpdateOrderItemInput,
): Promise<OrderItemDetail> => {
  const data: UpdateOrderItemData = {
    ...(input.quantity === undefined
      ? {}
      : {
          quantity: input.quantity,
        }),

    ...(input.notes === undefined
      ? {}
      : {
          notes: input.notes,
        }),
  };

  const result = await updateOrderItemRecord(
    businessId,
    orderId,
    orderItemId,
    data,
  );

  switch (result.kind) {
    case "UPDATED":
      return result.orderItem;

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_OPEN":
      throw new AppError(
        "Solo se pueden editar productos de una orden abierta",
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

export { updateItemInOrder };
