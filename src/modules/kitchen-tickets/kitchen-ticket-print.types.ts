import type { OrderServiceType } from "../orders/order.types";
import type { ProductFulfillmentMode } from "../products/product.types";
import type { KitchenPreparationStatus } from "./kitchen-ticket.types";

type KitchenTicketPrintType = "INITIAL" | "MODIFICATION" | "REPRINT";

type KitchenTicketPrintSnapshotItem = Readonly<{
  kitchenTicketItemId: string;
  orderItemId: string;
  productName: string;
  fulfillmentMode: ProductFulfillmentMode;
  quantity: number;
  notes: string | null;
  preparationStatus: KitchenPreparationStatus;
}>;

type KitchenTicketPrintSnapshot = Readonly<{
  businessId: string;
  kitchenTicketId: string;
  orderId: string;
  preparationAreaId: string;
  preparationAreaName: string;
  ticketVersion: number;
  serviceType: OrderServiceType;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  orderNotes: string | null;
  generatedAt: string;
  items: readonly KitchenTicketPrintSnapshotItem[];
}>;

type KitchenTicketPrint = Readonly<{
  id: string;
  businessId: string;
  kitchenTicketId: string;
  printedByMembershipId: string;
  ticketVersion: number;
  printType: KitchenTicketPrintType;
  reason: string | null;
  printerName: string | null;
  contentSnapshot: KitchenTicketPrintSnapshot;
  createdAt: Date;
}>;

export type {
  KitchenTicketPrint,
  KitchenTicketPrintSnapshot,
  KitchenTicketPrintSnapshotItem,
  KitchenTicketPrintType,
};
