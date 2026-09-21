import { AppError } from "../../../shared/errors/app-error";
import type { OrderItem } from "../order.types";
import { addOrderItems as addOrderItemsRecords } from "../repositories/order-item.repository";
import type { AddOrderItemsInput } from "../schemas/add-order-item.schema";

const addItemsToOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
  input: AddOrderItemsInput,
): Promise<OrderItem[]> => {
  const result = await addOrderItemsRecords(businessId, orderId, {
    addedByMembershipId: membershipId,
    items: input.items,
  });

  switch (result.kind) {
    case "CREATED":
      return result.orderItems;

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_EDITABLE":
      throw new AppError(
        "No se pueden agregar productos a una orden finalizada",
        409,
        "ORDER_NOT_EDITABLE",
      );

    case "PRODUCT_NOT_FOUND":
      throw new AppError(
        "Uno de los productos no existe",
        404,
        "PRODUCT_NOT_FOUND",
      );

    case "PRODUCT_UNAVAILABLE":
      throw new AppError(
        "Uno de los productos no está disponible",
        409,
        "PRODUCT_UNAVAILABLE",
      );
  }
};

export { addItemsToOrder };
