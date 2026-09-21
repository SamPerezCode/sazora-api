import type { KitchenTicket } from "../kitchen-ticket.types";
import { findActiveKitchenTickets } from "../repositories/kitchen-ticket.repository";
import type { ListKitchenTicketsQuery } from "../schemas/list-kitchen-tickets.schema";

const listKitchenTickets = async (
  businessId: string,
  query: ListKitchenTicketsQuery,
): Promise<KitchenTicket[]> => {
  return findActiveKitchenTickets(businessId, query.preparationAreaId);
};

export { listKitchenTickets };
