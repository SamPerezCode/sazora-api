import { AppError } from "../../../shared/errors/app-error";
import type { OrderDetail } from "../order.types";
import { findOrderDetailById } from "../repositories/get-order.repository";

const getOrder = async (
  businessId: string,
  orderId: string,
): Promise<OrderDetail> => {
  const order = await findOrderDetailById(businessId, orderId);

  if (!order) {
    throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");
  }

  return order;
};

export { getOrder };
