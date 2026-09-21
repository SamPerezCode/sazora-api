import type { OrderServiceType } from "../orders/order.types";
import type { ProductFulfillmentMode } from "../products/product.types";

type KitchenPreparationStatus =
  "PENDING" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";

type KitchenTicketStatus = "PENDING" | "IN_PREPARATION" | "READY";

type KitchenProgressStatus = "IN_PREPARATION" | "READY" | "DELIVERED";

type KitchenTicketItem = Readonly<{
  id: string;
  orderItemId: string;
  productName: string;
  fulfillmentMode: ProductFulfillmentMode;
  quantity: number;
  notes: string | null;
  preparationStatus: KitchenPreparationStatus;
  startedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type KitchenTicket = Readonly<{
  id: string;
  businessId: string;
  orderId: string;
  preparationAreaId: string;
  preparationAreaName: string;
  serviceType: OrderServiceType;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  orderNotes: string | null;
  currentVersion: number;
  status: KitchenTicketStatus;
  items: readonly KitchenTicketItem[];
  createdAt: Date;
  updatedAt: Date;
}>;

export type {
  KitchenPreparationStatus,
  KitchenProgressStatus,
  KitchenTicket,
  KitchenTicketItem,
  KitchenTicketStatus,
};
