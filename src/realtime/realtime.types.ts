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

interface PublicOrderRequestCreatedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  serviceType: "DELIVERY" | "TAKEAWAY";
  customerName: string;
  customerPhone: string;
  itemCount: number;
  subtotal: string;
  createdAt: string;
  recipientMembershipIds: readonly string[];
}

interface ClientToServerEvents {
  "session:ping": (acknowledge: (payload: SessionPingPayload) => void) => void;
}
interface PublicOrderRequestOrderConfirmedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  orderId: string;
  orderStatus: "CONFIRMED";
  serviceType: "DELIVERY" | "TAKEAWAY";
  confirmedByMembershipId: string;
  confirmedAt: string | null;
  kitchenTickets: readonly KitchenTicketCreatedSummary[];
}

interface PublicOrderRequestPreparationUpdatedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  orderId: string;
  serviceType: "DELIVERY" | "TAKEAWAY";
  kitchenTicketId: string;
  kitchenTicketItemId: string;
  preparationStatus:
    "PENDING" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";
  orderStatus: "CONFIRMED" | "DELIVERED";
  orderDelivered: boolean;
  updatedAt: string;
}

interface PublicOrderRequestOrderClosedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  orderId: string;
  serviceType: "DELIVERY" | "TAKEAWAY";
  orderStatus: "CLOSED";
  closedByMembershipId: string;
  closedAt: string;
}

interface DeliveryStatusUpdatedPayload {
  businessId: string;
  deliveryId: string;
  requestId: string;
  publicCode: string;
  orderId: string;
  previousStatus:
    | "PENDING_ASSIGNMENT"
    | "ASSIGNED"
    | "PICKED_UP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";
  status:
    | "PENDING_ASSIGNMENT"
    | "ASSIGNED"
    | "PICKED_UP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";
  deliveryMode: "INTERNAL" | "EXTERNAL" | null;
  externalProviderName: string | null;
  assignedDriverMembershipId: string | null;
  changedAt: string;
}

interface ServerToClientEvents {
  "public-order-request:created": (
    payload: PublicOrderRequestCreatedPayload,
  ) => void;
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
  "public-order-request:status-updated": (
    payload: PublicOrderRequestStatusUpdatedPayload,
  ) => void;
  "public-order-request:order-confirmed": (
    payload: PublicOrderRequestOrderConfirmedPayload,
  ) => void;
  "public-order-request:preparation-updated": (
    payload: PublicOrderRequestPreparationUpdatedPayload,
  ) => void;
  "public-order-request:order-closed": (
    payload: PublicOrderRequestOrderClosedPayload,
  ) => void;
  "delivery:status-updated": (payload: DeliveryStatusUpdatedPayload) => void;
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

interface PublicOrderRequestStatusUpdatedPayload {
  businessId: string;
  requestId: string;
  publicCode: string;
  previousStatus: "NEW" | "CONTACTED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  status: "NEW" | "CONTACTED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  handledByMembershipId: string | null;
  orderId: string | null;
  changedAt: string;
}

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
  PublicOrderRequestCreatedPayload,
  PublicOrderRequestStatusUpdatedPayload,
  PublicOrderRequestOrderConfirmedPayload,
  PublicOrderRequestPreparationUpdatedPayload,
  PublicOrderRequestOrderClosedPayload,
  DeliveryStatusUpdatedPayload,
};
