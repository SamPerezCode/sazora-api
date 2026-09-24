import { getBusinessRoleRoom, getMembershipRoom } from "./realtime.rooms";
import { getRealtimeServer } from "./realtime.server";
import type {
  KitchenTicketItemStatusUpdatedPayload,
  OrderConfirmedPayload,
  OrderCreatedPayload,
  OrderItemCancelledPayload,
  OrderItemRemovedPayload,
  OrderItemsAddedPayload,
  OrderItemUpdatedPayload,
  OrderStatusUpdatedPayload,
  OrderUpdatedPayload,
  PublicOrderRequestCreatedPayload,
  PublicOrderRequestStatusUpdatedPayload,
  PublicOrderRequestOrderConfirmedPayload,
  PublicOrderRequestPreparationUpdatedPayload,
  PublicOrderRequestOrderClosedPayload,
  DeliveryStatusUpdatedPayload,
} from "./realtime.types";

const getOperationalRooms = (businessId: string): string[] => [
  getBusinessRoleRoom(businessId, "ADMIN"),
  getBusinessRoleRoom(businessId, "WAITER"),
  getBusinessRoleRoom(businessId, "KITCHEN"),
];

const getOrderEditingRooms = (businessId: string): string[] => [
  getBusinessRoleRoom(businessId, "ADMIN"),
  getBusinessRoleRoom(businessId, "WAITER"),
];

const emitOrderCreated = (payload: OrderCreatedPayload): void => {
  getRealtimeServer()
    .to(getOrderEditingRooms(payload.businessId))
    .emit("order:created", payload);
};

const emitOrderConfirmed = (payload: OrderConfirmedPayload): void => {
  getRealtimeServer()
    .to(getOperationalRooms(payload.businessId))
    .emit("order:confirmed", payload);
};

const emitKitchenTicketItemStatusUpdated = (
  payload: KitchenTicketItemStatusUpdatedPayload,
): void => {
  getRealtimeServer()
    .to(getOperationalRooms(payload.businessId))
    .emit("kitchen-ticket:item-status-updated", payload);
};

const emitOrderStatusUpdated = (payload: OrderStatusUpdatedPayload): void => {
  getRealtimeServer()
    .to(getOperationalRooms(payload.businessId))
    .emit("order:status-updated", payload);
};

const emitOrderItemsAdded = (payload: OrderItemsAddedPayload): void => {
  const rooms =
    payload.orderStatus === "CONFIRMED"
      ? getOperationalRooms(payload.businessId)
      : getOrderEditingRooms(payload.businessId);

  getRealtimeServer().to(rooms).emit("order:items-added", payload);
};

const emitOrderItemUpdated = (payload: OrderItemUpdatedPayload): void => {
  getRealtimeServer()
    .to(getOrderEditingRooms(payload.businessId))
    .emit("order:item-updated", payload);
};

const emitOrderItemRemoved = (payload: OrderItemRemovedPayload): void => {
  getRealtimeServer()
    .to(getOrderEditingRooms(payload.businessId))
    .emit("order:item-removed", payload);
};

const emitOrderItemCancelled = (payload: OrderItemCancelledPayload): void => {
  getRealtimeServer()
    .to(getOperationalRooms(payload.businessId))
    .emit("order:item-cancelled", payload);
};

const emitOrderUpdated = (payload: OrderUpdatedPayload): void => {
  getRealtimeServer()
    .to(getOrderEditingRooms(payload.businessId))
    .emit("order:updated", payload);
};

const emitPublicOrderRequestCreated = (
  payload: PublicOrderRequestCreatedPayload,
): void => {
  const recipientRooms =
    payload.recipientMembershipIds.length > 0
      ? payload.recipientMembershipIds.map(getMembershipRoom)
      : [getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER")];

  const rooms = [
    getBusinessRoleRoom(payload.businessId, "ADMIN"),
    ...recipientRooms,
  ];

  getRealtimeServer()
    .to([...new Set(rooms)])
    .emit("public-order-request:created", payload);
};

const emitPublicOrderRequestStatusUpdated = (
  payload: PublicOrderRequestStatusUpdatedPayload,
): void => {
  getRealtimeServer()
    .to([
      getBusinessRoleRoom(payload.businessId, "ADMIN"),
      getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
    ])
    .emit("public-order-request:status-updated", payload);
};

const emitPublicOrderRequestOrderConfirmed = (
  payload: PublicOrderRequestOrderConfirmedPayload,
): void => {
  getRealtimeServer()
    .to([
      getBusinessRoleRoom(payload.businessId, "ADMIN"),
      getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
    ])
    .emit("public-order-request:order-confirmed", payload);
};

const emitPublicOrderRequestPreparationUpdated = (
  payload: PublicOrderRequestPreparationUpdatedPayload,
): void => {
  getRealtimeServer()
    .to([
      getBusinessRoleRoom(payload.businessId, "ADMIN"),
      getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
    ])
    .emit("public-order-request:preparation-updated", payload);
};

const emitPublicOrderRequestOrderClosed = (
  payload: PublicOrderRequestOrderClosedPayload,
): void => {
  getRealtimeServer()
    .to([
      getBusinessRoleRoom(payload.businessId, "ADMIN"),
      getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
    ])
    .emit("public-order-request:order-closed", payload);
};

const emitDeliveryStatusUpdated = (
  payload: DeliveryStatusUpdatedPayload,
): void => {
  const rooms = [
    getBusinessRoleRoom(payload.businessId, "ADMIN"),
    getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
  ];

  if (payload.assignedDriverMembershipId) {
    rooms.push(getMembershipRoom(payload.assignedDriverMembershipId));
  }

  getRealtimeServer()
    .to([...new Set(rooms)])
    .emit("delivery:status-updated", payload);
};

export {
  emitKitchenTicketItemStatusUpdated,
  emitOrderConfirmed,
  emitOrderCreated,
  emitOrderItemCancelled,
  emitOrderItemRemoved,
  emitOrderItemsAdded,
  emitOrderItemUpdated,
  emitOrderStatusUpdated,
  emitOrderUpdated,
  emitPublicOrderRequestCreated,
  emitPublicOrderRequestStatusUpdated,
  emitPublicOrderRequestOrderConfirmed,
  emitPublicOrderRequestPreparationUpdated,
  emitPublicOrderRequestOrderClosed,
  emitDeliveryStatusUpdated,
};
