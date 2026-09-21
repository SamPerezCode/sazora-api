import type { ProductFulfillmentMode } from "../products/product.types";

type OrderServiceType = "TABLE" | "TAKEAWAY" | "DELIVERY";

type OrderStatus = "OPEN" | "CONFIRMED" | "DELIVERED" | "CLOSED" | "CANCELLED";

type OrderItemStatus = "ACTIVE" | "CANCELLED";

type Order = Readonly<{
  id: string;
  businessId: string;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: OrderServiceType;
  status: OrderStatus;
  customerCount: number | null;
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

type CreateOrderData = Readonly<{
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: OrderServiceType;
  customerCount: number | null;
  notes: string | null;
}>;

type NewOrderItemData = Readonly<{
  productId: string;
  quantity: number;
  notes: string | null;
}>;

type AddOrderItemsData = Readonly<{
  addedByMembershipId: string;
  items: readonly NewOrderItemData[];
}>;

type OrderItemDetail = OrderItem &
  Readonly<{
    lineTotal: string;
  }>;

type OrderDetail = Order &
  Readonly<{
    subtotal: string;
    items: readonly OrderItemDetail[];
  }>;

type OrderListItem = Order &
  Readonly<{
    restaurantTableCode: string | null;
    restaurantTableName: string | null;
    activeItemCount: number;
    subtotal: string;
  }>;

type ListOrdersFilters = Readonly<{
  status?: OrderStatus;
  serviceType?: OrderServiceType;
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
  notes?: string | null;
}>;

export type {
  AddOrderItemsData,
  CreateOrderData,
  ListOrdersFilters,
  NewOrderItemData,
  Order,
  OrderDetail,
  OrderItem,
  OrderItemDetail,
  OrderItemStatus,
  OrderListItem,
  OrderListResult,
  OrderServiceType,
  OrderStatus,
  UpdateOrderData,
  UpdateOrderItemData,
};
