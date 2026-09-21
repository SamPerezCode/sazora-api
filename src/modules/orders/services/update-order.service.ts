import { AppError } from "../../../shared/errors/app-error";
import type { OrderDetail, UpdateOrderData } from "../order.types";
import { updateOrder as updateOrderRecord } from "../repositories/update-order.repository";
import type { UpdateOrderInput } from "../schemas/update-order.schema";
import { getOrder } from "./get-order.service";

const updateOrderDetails = async (
  businessId: string,
  orderId: string,
  input: UpdateOrderInput,
): Promise<OrderDetail> => {
  const data: UpdateOrderData = {
    ...(input.serviceType === undefined
      ? {}
      : {
          serviceType: input.serviceType,
        }),

    ...(input.restaurantTableId === undefined
      ? {}
      : {
          restaurantTableId: input.restaurantTableId,
        }),

    ...(input.customerCount === undefined
      ? {}
      : {
          customerCount: input.customerCount,
        }),

    ...(input.notes === undefined
      ? {}
      : {
          notes: input.notes,
        }),
  };

  const result = await updateOrderRecord(businessId, orderId, data);

  switch (result.kind) {
    case "UPDATED":
      return getOrder(businessId, orderId);

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_OPEN":
      throw new AppError(
        "Solo se pueden editar órdenes abiertas",
        409,
        "ORDER_NOT_OPEN",
      );

    case "TABLE_NOT_FOUND":
      throw new AppError(
        "La mesa no existe",
        404,
        "RESTAURANT_TABLE_NOT_FOUND",
      );

    case "TABLE_INACTIVE":
      throw new AppError(
        "La mesa está desactivada",
        409,
        "RESTAURANT_TABLE_INACTIVE",
      );

    case "TABLE_OCCUPIED":
      throw new AppError(
        "La mesa ya tiene una orden activa",
        409,
        "RESTAURANT_TABLE_OCCUPIED",
      );
  }
};

export { updateOrderDetails };
