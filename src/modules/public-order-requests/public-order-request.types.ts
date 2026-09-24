type PublicOrderRequestServiceType = "DELIVERY" | "TAKEAWAY";

type PublicOrderRequestStatus =
  "NEW" | "CONTACTED" | "ACCEPTED" | "REJECTED" | "CANCELLED";

type NewPublicOrderRequestItem = Readonly<{
  productId: string;
  quantity: number;
  notes: string | null;
}>;

type CreatePublicOrderRequestData = Readonly<{
  serviceType: PublicOrderRequestServiceType;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  items: readonly NewPublicOrderRequestItem[];
}>;

type PublicOrderRequestItem = Readonly<{
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
}>;

type PublicOrderRequest = Readonly<{
  id: string;
  publicCode: string;
  businessId: string;
  serviceType: PublicOrderRequestServiceType;
  status: PublicOrderRequestStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  subtotal: string;
  handledByMembershipId: string | null;
  orderId: string | null;
  contactedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: readonly PublicOrderRequestItem[];
}>;

type PublicOrderRequestListItem = Omit<PublicOrderRequest, "items"> &
  Readonly<{
    itemCount: number;
  }>;

type PublicOrderTrackingPreparationStatus =
  "PENDING" | "IN_PREPARATION" | "READY" | "DELIVERED";

type PublicOrderTrackingItem = Readonly<{
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
}>;

type PublicOrderTracking = Readonly<{
  businessName: string;
  publicCode: string;
  serviceType: PublicOrderRequestServiceType;
  requestStatus: PublicOrderRequestStatus;
  orderStatus:
    "OPEN" | "CONFIRMED" | "DELIVERED" | "CLOSED" | "CANCELLED" | null;
  preparationStatus: PublicOrderTrackingPreparationStatus | null;
  subtotal: string;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: readonly PublicOrderTrackingItem[];
  fulfillmentStatus:
    | "PENDING_ASSIGNMENT"
    | "ASSIGNED"
    | "PICKED_UP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | null;
}>;

export type {
  CreatePublicOrderRequestData,
  NewPublicOrderRequestItem,
  PublicOrderRequest,
  PublicOrderRequestItem,
  PublicOrderRequestListItem,
  PublicOrderRequestServiceType,
  PublicOrderRequestStatus,
  PublicOrderTracking,
  PublicOrderTrackingItem,
  PublicOrderTrackingPreparationStatus,
};
