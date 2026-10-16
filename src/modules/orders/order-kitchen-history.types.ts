import type { KitchenWorkflowMode } from "../kitchen-settings/kitchen-settings.types";
import type { KitchenTicketPrint } from "../kitchen-tickets/kitchen-ticket-print.types";
import type {
  KitchenPreparationStatus,
  KitchenTicketItem,
} from "../kitchen-tickets/kitchen-ticket.types";

type OrderKitchenTicketStatus =
  "PENDING" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";

type OrderKitchenHistoryTicket = Readonly<{
  id: string;
  preparationAreaId: string;
  preparationAreaName: string;
  currentVersion: number;
  status: OrderKitchenTicketStatus;
  items: readonly KitchenTicketItem[];
  prints: readonly KitchenTicketPrint[];
  createdAt: Date;
  updatedAt: Date;
}>;

type OrderKitchenHistory = Readonly<{
  orderId: string;
  kitchenWorkflowMode: KitchenWorkflowMode | null;
  tickets: readonly OrderKitchenHistoryTicket[];
}>;

const calculateOrderKitchenTicketStatus = (
  statuses: readonly KitchenPreparationStatus[],
): OrderKitchenTicketStatus => {
  const activeStatuses = statuses.filter((status) => status !== "CANCELLED");

  if (activeStatuses.length === 0) {
    return "CANCELLED";
  }

  if (activeStatuses.every((status) => status === "DELIVERED")) {
    return "DELIVERED";
  }

  const undeliveredStatuses = activeStatuses.filter(
    (status) => status !== "DELIVERED",
  );

  if (
    undeliveredStatuses.length > 0 &&
    undeliveredStatuses.every((status) => status === "READY")
  ) {
    return "READY";
  }

  if (undeliveredStatuses.some((status) => status === "IN_PREPARATION")) {
    return "IN_PREPARATION";
  }

  return "PENDING";
};

export { calculateOrderKitchenTicketStatus };

export type {
  OrderKitchenHistory,
  OrderKitchenHistoryTicket,
  OrderKitchenTicketStatus,
};
