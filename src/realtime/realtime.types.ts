import type { Socket } from "socket.io";

import type { AccessTokenPayload } from "../modules/auth/auth.types";

interface SessionReadyPayload {
  userId: string;
  businessId: string;
  membershipId: string;
  roles: string[];
  connectedAt: string;
}

interface SessionPingPayload {
  serverTime: string;
}

interface KitchenTicketCreatedSummary {
  id: string;
  preparationAreaId: string;
  currentVersion: number;
  orderItemIds: readonly string[];
}

interface OrderCreatedPayload {
  businessId: string;
  orderId: string;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: "TABLE" | "TAKEAWAY" | "DELIVERY";
  status: "OPEN";
  customerCount: number | null;
  notes: string | null;
  createdAt: string;
}

interface OrderConfirmedPayload {
  businessId: string;
  orderId: string;
  status: "CONFIRMED";
  confirmedAt: string | null;
  kitchenTickets: readonly KitchenTicketCreatedSummary[];
}

interface KitchenTicketItemStatusUpdatedPayload {
  businessId: string;
  orderId: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus:
    "PENDING" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";
  orderDelivered: boolean;
  updatedAt: string;
}

type RealtimeOrderStatus =
  "OPEN" | "CONFIRMED" | "DELIVERED" | "CLOSED" | "CANCELLED";

interface OrderStatusUpdatedPayload {
  businessId: string;
  orderId: string;
  previousStatus: RealtimeOrderStatus;
  status: RealtimeOrderStatus;
  changedByMembershipId: string;
  changedAt: string;
}

interface OrderItemAddedPayloadItem {
  id: string;
  productId: string;
  preparationAreaId: string;
  fulfillmentMode: "PREPARE_TO_ORDER" | "READY_TO_SERVE";
  productName: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
}

interface OrderItemsAddedPayload {
  businessId: string;
  orderId: string;
  orderStatus: RealtimeOrderStatus;
  addedByMembershipId: string;
  orderItems: readonly OrderItemAddedPayloadItem[];
}

interface OrderItemUpdatedPayload {
  businessId: string;
  orderId: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
  updatedAt: string;
}

interface OrderItemRemovedPayload {
  businessId: string;
  orderId: string;
  orderItemId: string;
  removedAt: string;
}

interface OrderItemCancelledPayload {
  businessId: string;
  orderId: string;
  orderItemId: string;
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  kitchenTicketVersion: number;
  preparationStatus: "CANCELLED";
  orderStatus: RealtimeOrderStatus;
  cancellationReason: string;
  cancelledByMembershipId: string;
  cancelledAt: string;
}

interface OrderUpdatedPayload {
  businessId: string;
  orderId: string;
  status: RealtimeOrderStatus;
  serviceType: "TABLE" | "TAKEAWAY" | "DELIVERY";
  restaurantTableId: string | null;
  customerCount: number | null;
  notes: string | null;
  changedByMembershipId: string;
  updatedAt: string;
}

interface ClientToServerEvents {
  "session:ping": (acknowledge: (payload: SessionPingPayload) => void) => void;
}

interface ServerToClientEvents {
  "session:ready": (payload: SessionReadyPayload) => void;
  "order:created": (payload: OrderCreatedPayload) => void;
  "order:confirmed": (payload: OrderConfirmedPayload) => void;
  "kitchen-ticket:item-status-updated": (
    payload: KitchenTicketItemStatusUpdatedPayload,
  ) => void;
  "order:status-updated": (payload: OrderStatusUpdatedPayload) => void;
  "order:items-added": (payload: OrderItemsAddedPayload) => void;
  "order:item-updated": (payload: OrderItemUpdatedPayload) => void;
  "order:item-removed": (payload: OrderItemRemovedPayload) => void;
  "order:item-cancelled": (payload: OrderItemCancelledPayload) => void;
  "order:updated": (payload: OrderUpdatedPayload) => void;
}

type InterServerEvents = Record<never, never>;

interface SocketData {
  auth: AccessTokenPayload;
}

type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type {
  ClientToServerEvents,
  InterServerEvents,
  KitchenTicketCreatedSummary,
  KitchenTicketItemStatusUpdatedPayload,
  OrderConfirmedPayload,
  OrderCreatedPayload,
  OrderItemAddedPayloadItem,
  OrderItemCancelledPayload,
  OrderItemRemovedPayload,
  OrderItemsAddedPayload,
  OrderItemUpdatedPayload,
  OrderStatusUpdatedPayload,
  OrderUpdatedPayload,
  RealtimeOrderStatus,
  RealtimeSocket,
  ServerToClientEvents,
  SessionPingPayload,
  SessionReadyPayload,
  SocketData,
};
