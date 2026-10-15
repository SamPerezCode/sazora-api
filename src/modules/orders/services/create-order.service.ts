import { emitOrderCreated } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import type { OrderDetail } from "../order.types";
import { createOrder as createOrderRecord } from "../repositories/order.repository";
import type { CreateOrderInput } from "../schemas/create-order.schema";
import { getOrder } from "./get-order.service";

const createOrder = async (
  businessId: string,
  membershipId: string,
  locationId: string,
  input: CreateOrderInput,
): Promise<OrderDetail> => {
  const result = await createOrderRecord(businessId, {
    restaurantTableId: input.restaurantTableId,
    openedByMembershipId: membershipId,
    serviceType: input.serviceType,
    customerCount: input.customerCount,
    notes: input.notes,
    items: input.items,
    locationId,
  });

  switch (result.kind) {
    case "CREATED": {
      const order = await getOrder(businessId, result.order.id);

      emitOrderCreated({
        businessId,
        orderId: order.id,
        restaurantTableId: order.restaurantTableId,
        openedByMembershipId: order.openedByMembershipId,
        serviceType: order.serviceType,
        status: "OPEN",
        customerCount: order.customerCount,
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
      });

      return order;
    }

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

    case "LOCATION_NOT_AVAILABLE":
      throw new AppError(
        "El punto de venta no existe, está inactivo o no pertenece al negocio",
        409,
        "ORDER_LOCATION_NOT_AVAILABLE",
      );

    case "LOCATION_NOT_POINT_OF_SALE":
      throw new AppError(
        "Las órdenes de venta solamente pueden crearse en puntos de venta",
        409,
        "LOCATION_NOT_POINT_OF_SALE",
      );

    case "TABLE_LOCATION_MISMATCH":
      throw new AppError(
        "La mesa no pertenece al punto de venta de la orden",
        409,
        "ORDER_TABLE_LOCATION_MISMATCH",
      );

    case "PRODUCT_NOT_AVAILABLE_AT_LOCATION":
      throw new AppError(
        "Uno de los productos no está disponible en esta ubicación",
        409,
        "PRODUCT_NOT_AVAILABLE_AT_LOCATION",
      );
  }
};

export { createOrder };
