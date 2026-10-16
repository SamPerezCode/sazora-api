import { AppError } from "../../../shared/errors/app-error";
import type { OrderKitchenHistory } from "../order-kitchen-history.types";
import { findOrderKitchenHistory } from "../repositories/get-order-kitchen-history.repository";

const getOrderKitchenHistory = async (
  businessId: string,
  orderId: string,
): Promise<OrderKitchenHistory> => {
  const kitchenHistory = await findOrderKitchenHistory(businessId, orderId);

  if (!kitchenHistory) {
    throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");
  }

  return kitchenHistory;
};

export { getOrderKitchenHistory };
