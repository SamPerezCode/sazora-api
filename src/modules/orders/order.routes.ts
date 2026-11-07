import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
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
} from "./controllers/order.controller";

const orderRouter = Router();

orderRouter.get(
  "/",
  authenticate,
  authorizePermissions("orders.read"),
  listOrdersController,
);

orderRouter.post(
  "/",
  authenticate,
  authorizePermissions("orders.manage"),
  createOrderController,
);

orderRouter.get(
  "/:orderId/kitchen-history",
  authenticate,
  authorizePermissions("orders.read"),
  getOrderKitchenHistoryController,
);

orderRouter.get(
  "/:orderId",
  authenticate,
  authorizePermissions("orders.read"),
  getOrderController,
);

orderRouter.patch(
  "/:orderId",
  authenticate,
  authorizePermissions("orders.manage"),
  updateOrderController,
);

orderRouter.post(
  "/:orderId/cancel",
  authenticate,
  authorizePermissions("orders.cancel"),
  cancelOrderController,
);

orderRouter.post(
  "/:orderId/confirm",
  authenticate,
  authorizePermissions("orders.manage"),
  confirmOrderController,
);

orderRouter.post(
  "/:orderId/deliver",
  authenticate,
  authorizePermissions("orders.manage"),
  deliverPrintOnlyOrderController,
);

orderRouter.post(
  "/:orderId/close",
  authenticate,
  authorizePermissions("orders.close"),
  closeOrderController,
);

orderRouter.post(
  "/:orderId/items",
  authenticate,
  authorizePermissions("orders.manage"),
  addOrderItemsController,
);

orderRouter.patch(
  "/:orderId/items/:orderItemId",
  authenticate,
  authorizePermissions("orders.manage"),
  updateOrderItemController,
);

orderRouter.post(
  "/:orderId/items/:orderItemId/cancel-quantity",
  authenticate,
  authorizePermissions("orders.cancel"),
  cancelOrderItemQuantityController,
);

orderRouter.post(
  "/:orderId/items/:orderItemId/cancel",
  authenticate,
  authorizePermissions("orders.cancel"),
  cancelOrderItemController,
);

orderRouter.delete(
  "/:orderId/items/:orderItemId",
  authenticate,
  authorizePermissions("orders.manage"),
  removeOrderItemController,
);

export { orderRouter };
