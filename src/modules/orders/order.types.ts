import type { LocationType } from "../locations/location.types";
import type { ProductFulfillmentMode } from "../products/product.types";
import type { KitchenWorkflowMode } from "../kitchen-settings/kitchen-settings.types";
import type { TaxType } from "../tax-classes/tax-class.types";

type OrderServiceType = "TABLE" | "TAKEAWAY" | "DELIVERY";

type OrderSourceChannel = "IN_PERSON" | "WHATSAPP" | "PHONE" | "PUBLIC_MENU";

type OrderStatus = "OPEN" | "CONFIRMED" | "DELIVERED" | "CLOSED" | "CANCELLED";

type OrderPaymentStatus =
  "PENDING" | "VERIFIED" | "CONSUMED" | "REFUNDED" | "VOIDED";

type OrderItemStatus = "ACTIVE" | "CANCELLED";

type OrderLocation = Readonly<{
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  isActive: boolean;
}>;

type Order = Readonly<{
  id: string;
  businessId: string;
  locationId: string;
  commercialCustomerId: string | null;
  location: OrderLocation;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: OrderServiceType;
  sourceChannel: OrderSourceChannel;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentVerifiedAt: Date | null;
  kitchenWorkflowMode: KitchenWorkflowMode | null;
  customerCount: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type OrderItem = Readonly<{
  id: string;
  businessId: string;
  orderId: string;
  productId: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  addedByMembershipId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  notes: string | null;
  status: OrderItemStatus;
  cancelledByMembershipId: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type NewOrderItemData = Readonly<{
  productId: string;
  quantity: number;
  notes: string | null;
}>;

type CreateOrderData = Readonly<{
  locationId: string;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: OrderServiceType;
  sourceChannel: Exclude<OrderSourceChannel, "PUBLIC_MENU">;
  customerCount: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  items: readonly NewOrderItemData[];
}>;

type AddOrderItemsData = Readonly<{
  addedByMembershipId: string;
  items: readonly NewOrderItemData[];
}>;

type OrderItemDetail = OrderItem &
  Readonly<{
    taxClassId: string | null;
    taxCode: string | null;
    taxName: string | null;
    taxType: TaxType | null;
    taxRate: string;
    priceIncludesTax: boolean;
    unitNetPrice: string;
    unitTaxAmount: string;
    lineNetTotal: string;
    lineTaxTotal: string;
    lineTotal: string;
  }>;

type OrderFulfillmentSummary = Readonly<{
  activeItemCount: number;
  activeUnitCount: number;
  readyToServeUnitCount: number;
  prepareToOrderUnitCount: number;
  requiresPreparation: boolean;
}>;

type OrderDetail = Order &
  Readonly<{
    subtotal: string;
    netSubtotal: string;
    taxTotal: string;
    total: string;
    fulfillmentSummary: OrderFulfillmentSummary;
    items: readonly OrderItemDetail[];
  }>;

type OrderListItem = Order &
  Readonly<{
    restaurantTableCode: string | null;
    restaurantTableName: string | null;
    activeItemCount: number;
    subtotal: string;
    fulfillmentSummary: OrderFulfillmentSummary;
  }>;

type ListOrdersFilters = Readonly<{
  locationId?: string;
  status?: OrderStatus;
  serviceType?: OrderServiceType;
  sourceChannel?: OrderSourceChannel;
  page: number;
  pageSize: number;
}>;

type OrderListResult = Readonly<{
  orders: readonly OrderListItem[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>;
}>;

type UpdateOrderItemData = Readonly<{
  quantity?: number;
  notes?: string | null;
}>;

type UpdateOrderData = Readonly<{
  serviceType?: OrderServiceType;
  restaurantTableId?: string | null;
  customerCount?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
}>;

export type {
  AddOrderItemsData,
  CreateOrderData,
  ListOrdersFilters,
  NewOrderItemData,
  Order,
  OrderDetail,
  OrderFulfillmentSummary,
  OrderItem,
  OrderItemDetail,
  OrderItemStatus,
  OrderListItem,
  OrderListResult,
  OrderLocation,
  OrderPaymentStatus,
  OrderServiceType,
  OrderStatus,
  UpdateOrderData,
  OrderSourceChannel,
  UpdateOrderItemData,
};
