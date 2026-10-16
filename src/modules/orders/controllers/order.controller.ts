import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  addOrderItemsSchema,
  orderIdParamsSchema,
  orderItemIdParamsSchema,
} from "../schemas/add-order-item.schema";
import { cancelOrderItemSchema } from "../schemas/cancel-order-item.schema";
import { cancelOrderSchema } from "../schemas/cancel-order.schema";
import { createOrderSchema } from "../schemas/create-order.schema";
import { listOrdersQuerySchema } from "../schemas/list-orders.schema";
import { updateOrderItemSchema } from "../schemas/update-order-item.schema";
import { updateOrderSchema } from "../schemas/update-order.schema";
import { cancelOrderItemQuantitySchema } from "../schemas/cancel-order-item-quantity.schema";
import { addItemsToOrder } from "../services/add-order-item.service";
import { cancelItemFromConfirmedOrder } from "../services/cancel-order-item.service";
import { cancelOrder } from "../services/cancel-order.service";
import { closeDeliveredOrder } from "../services/close-order.service";
import { confirmOrder } from "../services/confirm-order.service";
import { createOrder } from "../services/create-order.service";
import { getOrder } from "../services/get-order.service";
import { listOrders } from "../services/list-orders.service";
import { removeItemFromOrder } from "../services/remove-order-item.service";
import { updateItemInOrder } from "../services/update-order-item.service";
import { updateOrderDetails } from "../services/update-order.service";
import { cancelQuantityFromConfirmedOrderItem } from "../services/cancel-order-item-quantity.service";
import type { AuthenticatedSession } from "../../auth/auth.types";
import { deliverOrderWithoutKitchenScreen } from "../services/deliver-print-only-order.service";
import { getOrderKitchenHistory } from "../services/get-order-kitchen-history.service";

import {
  assertOrderLocationAccess,
  resolveOrderLocationScope,
} from "../services/order-location-access.service";

const requireAuth = (
  request: Parameters<RequestHandler>[0],
): AuthenticatedSession => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const requireOrderAccess = async (
  request: Parameters<RequestHandler>[0],
  orderId: string,
): Promise<AuthenticatedSession> => {
  const auth = requireAuth(request);

  await assertOrderLocationAccess(auth, orderId);

  return auth;
};

const createOrderController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const input = createOrderSchema.parse(request.body);

  const locationId = resolveOrderLocationScope(auth, input.locationId, true);

  if (!locationId) {
    throw new AppError(
      "Debes seleccionar el punto de venta",
      400,
      "ORDER_LOCATION_REQUIRED",
    );
  }

  const order = await createOrder(
    auth.businessId,
    auth.membershipId,
    locationId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: { order },
  });
};

const listOrdersController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);
  const query = listOrdersQuerySchema.parse(request.query);

  const locationId = resolveOrderLocationScope(auth, query.locationId, false);

  const result = await listOrders(auth.businessId, query, locationId);

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const getOrderController: RequestHandler = async (request, response) => {
  const { orderId } = orderIdParamsSchema.parse(request.params);
  const auth = await requireOrderAccess(request, orderId);

  const order = await getOrder(auth.businessId, orderId);

  response.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
};

const getOrderKitchenHistoryController: RequestHandler = async (
  request,
  response,
) => {
  const { orderId } = orderIdParamsSchema.parse(request.params);

  const auth = await requireOrderAccess(request, orderId);

  const kitchenHistory = await getOrderKitchenHistory(auth.businessId, orderId);

  response.status(200).json({
    status: "success",
    data: {
      kitchenHistory,
    },
  });
};

const updateOrderController: RequestHandler = async (request, response) => {
  const { orderId } = orderIdParamsSchema.parse(request.params);
  const auth = await requireOrderAccess(request, orderId);
  const input = updateOrderSchema.parse(request.body);

  const order = await updateOrderDetails(
    auth.businessId,
    auth.membershipId,
    orderId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
};

const cancelOrderController: RequestHandler = async (request, response) => {
  const { orderId } = orderIdParamsSchema.parse(request.params);
  const auth = await requireOrderAccess(request, orderId);
  const input = cancelOrderSchema.parse(request.body);

  const result = await cancelOrder(
    auth.businessId,
    auth.membershipId,
    orderId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const confirmOrderController: RequestHandler = async (request, response) => {
  const { orderId } = orderIdParamsSchema.parse(request.params);
  const auth = await requireOrderAccess(request, orderId);

  const result = await confirmOrder(
    auth.businessId,
    auth.membershipId,
    orderId,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const addOrderItemsController: RequestHandler = async (request, response) => {
  const { orderId } = orderIdParamsSchema.parse(request.params);
  const auth = await requireOrderAccess(request, orderId);
  const input = addOrderItemsSchema.parse(request.body);

  const orderItems = await addItemsToOrder(
    auth.businessId,
    auth.membershipId,
    orderId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      orderItems,
    },
  });
};

const updateOrderItemController: RequestHandler = async (request, response) => {
  const { orderId, orderItemId } = orderItemIdParamsSchema.parse(
    request.params,
  );

  const auth = await requireOrderAccess(request, orderId);
  const input = updateOrderItemSchema.parse(request.body);

  const orderItem = await updateItemInOrder(
    auth.businessId,
    orderId,
    orderItemId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      orderItem,
    },
  });
};

const removeOrderItemController: RequestHandler = async (request, response) => {
  const { orderId, orderItemId } = orderItemIdParamsSchema.parse(
    request.params,
  );

  const auth = await requireOrderAccess(request, orderId);

  await removeItemFromOrder(auth.businessId, orderId, orderItemId);

  response.status(204).send();
};

const cancelOrderItemController: RequestHandler = async (request, response) => {
  const { orderId, orderItemId } = orderItemIdParamsSchema.parse(
    request.params,
  );

  const auth = await requireOrderAccess(request, orderId);
  const input = cancelOrderItemSchema.parse(request.body);

  const cancellation = await cancelItemFromConfirmedOrder(
    auth.businessId,
    auth.membershipId,
    orderId,
    orderItemId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      cancellation,
    },
  });
};

const deliverPrintOnlyOrderController: RequestHandler = async (
  request,
  response,
) => {
  const { orderId } = orderIdParamsSchema.parse(request.params);
  const auth = await requireOrderAccess(request, orderId);

  const result = await deliverOrderWithoutKitchenScreen(
    auth.businessId,
    auth.membershipId,
    orderId,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const closeOrderController: RequestHandler = async (request, response) => {
  const { orderId } = orderIdParamsSchema.parse(request.params);
  const auth = await requireOrderAccess(request, orderId);

  const order = await closeDeliveredOrder(
    auth.businessId,
    auth.membershipId,
    orderId,
  );

  response.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
};

const cancelOrderItemQuantityController: RequestHandler = async (
  request,
  response,
) => {
  const { orderId, orderItemId } = orderItemIdParamsSchema.parse(
    request.params,
  );

  const auth = await requireOrderAccess(request, orderId);
  const input = cancelOrderItemQuantitySchema.parse(request.body);

  const adjustment = await cancelQuantityFromConfirmedOrderItem(
    auth.businessId,
    auth.membershipId,
    orderId,
    orderItemId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      adjustment,
    },
  });
};
export {
  addOrderItemsController,
  cancelOrderController,
  cancelOrderItemController,
  cancelOrderItemQuantityController,
  closeOrderController,
  confirmOrderController,
  createOrderController,
  deliverPrintOnlyOrderController,
  getOrderController,
  getOrderKitchenHistoryController,
  listOrdersController,
  removeOrderItemController,
  updateOrderController,
  updateOrderItemController,
};
