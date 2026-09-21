import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  addOrderItemsController,
  confirmOrderController,
  createOrderController,
  getOrderController,
  listOrdersController,
  removeOrderItemController,
  updateOrderController,
  updateOrderItemController,
  cancelOrderItemController,
  closeOrderController,
} from "./controllers/order.controller";

const orderRouter = Router();

orderRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  listOrdersController,
);

orderRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  createOrderController,
);

orderRouter.get(
  "/:orderId",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  getOrderController,
);

orderRouter.patch(
  "/:orderId",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  updateOrderController,
);

orderRouter.post(
  "/:orderId/confirm",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  confirmOrderController,
);

orderRouter.post(
  "/:orderId/close",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  closeOrderController,
);

orderRouter.post(
  "/:orderId/items",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  addOrderItemsController,
);

orderRouter.patch(
  "/:orderId/items/:orderItemId",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  updateOrderItemController,
);

orderRouter.post(
  "/:orderId/items/:orderItemId/cancel",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  cancelOrderItemController,
);

orderRouter.delete(
  "/:orderId/items/:orderItemId",
  authenticate,
  authorizeRoles("ADMIN", "WAITER"),
  removeOrderItemController,
);

export { orderRouter };
