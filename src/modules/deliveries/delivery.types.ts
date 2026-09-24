type DeliveryMode = "INTERNAL" | "EXTERNAL";

type DeliveryStatus =
  | "PENDING_ASSIGNMENT"
  | "ASSIGNED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

type Delivery = Readonly<{
  id: string;
  businessId: string;
  publicOrderRequestId: string;
  publicCode: string;
  orderId: string;
  orderStatus: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryMode: DeliveryMode | null;
  assignedDriverMembershipId: string | null;
  assignedDriverName: string | null;
  externalProviderName: string | null;
  assignedByMembershipId: string | null;
  status: DeliveryStatus;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type DeliveryStatusChange = Readonly<{
  delivery: Delivery;
  previousStatus: DeliveryStatus;
}>;

export type { Delivery, DeliveryMode, DeliveryStatus, DeliveryStatusChange };
