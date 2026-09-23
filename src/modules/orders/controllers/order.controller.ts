import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  addOrderItemsSchema,
  orderIdParamsSchema,
  orderItemIdParamsSchema,
} from "../schemas/add-order-item.schema";
import { createOrderSchema } from "../schemas/create-order.schema";
import { listOrdersQuerySchema } from "../schemas/list-orders.schema";
import { updateOrderItemSchema } from "../schemas/update-order-item.schema";
import { updateOrderSchema } from "../schemas/update-order.schema";
import { addItemsToOrder } from "../services/add-order-item.service";
import { confirmOrder } from "../services/confirm-order.service";
import { createOrder } from "../services/create-order.service";
import { getOrder } from "../services/get-order.service";
import { listOrders } from "../services/list-orders.service";
import { removeItemFromOrder } from "../services/remove-order-item.service";
import { updateItemInOrder } from "../services/update-order-item.service";
import { updateOrderDetails } from "../services/update-order.service";
import { cancelOrderItemSchema } from "../schemas/cancel-order-item.schema";
import { cancelItemFromConfirmedOrder } from "../services/cancel-order-item.service";
import { closeDeliveredOrder } from "../services/close-order.service";

const createOrderController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const input = createOrderSchema.parse(request.body);

  const order = await createOrder(
    request.auth.businessId,
    request.auth.membershipId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      order,
    },
  });
};

const listOrdersController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const query = listOrdersQuerySchema.parse(request.query);

  const result = await listOrders(request.auth.businessId, query);

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const getOrderController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId } = orderIdParamsSchema.parse(request.params);

  const order = await getOrder(request.auth.businessId, orderId);

  response.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
};

const updateOrderController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId } = orderIdParamsSchema.parse(request.params);

  const input = updateOrderSchema.parse(request.body);

  const order = await updateOrderDetails(
    request.auth.businessId,
    request.auth.membershipId,
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

const confirmOrderController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId } = orderIdParamsSchema.parse(request.params);

  const result = await confirmOrder(
    request.auth.businessId,
    request.auth.membershipId,
    orderId,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const addOrderItemsController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId } = orderIdParamsSchema.parse(request.params);

  const input = addOrderItemsSchema.parse(request.body);

  const orderItems = await addItemsToOrder(
    request.auth.businessId,
    request.auth.membershipId,
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
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId, orderItemId } = orderItemIdParamsSchema.parse(
    request.params,
  );

  const input = updateOrderItemSchema.parse(request.body);

  const orderItem = await updateItemInOrder(
    request.auth.businessId,
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
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId, orderItemId } = orderItemIdParamsSchema.parse(
    request.params,
  );

  await removeItemFromOrder(request.auth.businessId, orderId, orderItemId);

  response.status(204).send();
};

const cancelOrderItemController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId, orderItemId } = orderItemIdParamsSchema.parse(
    request.params,
  );

  const input = cancelOrderItemSchema.parse(request.body);

  const cancellation = await cancelItemFromConfirmedOrder(
    request.auth.businessId,
    request.auth.membershipId,
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

const closeOrderController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId } = orderIdParamsSchema.parse(request.params);

  const order = await closeDeliveredOrder(
    request.auth.businessId,
    request.auth.membershipId,
    orderId,
  );

  response.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
};

export {
  addOrderItemsController,
  cancelOrderItemController,
  closeOrderController,
  confirmOrderController,
  createOrderController,
  getOrderController,
  listOrdersController,
  removeOrderItemController,
  updateOrderController,
  updateOrderItemController,
};
