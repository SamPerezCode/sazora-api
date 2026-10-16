import type { KitchenTicket } from "../kitchen-ticket.types";
import { findActiveKitchenTickets } from "../repositories/kitchen-ticket.repository";
import type { ListKitchenTicketsQuery } from "../schemas/list-kitchen-tickets.schema";

const listKitchenTickets = async (
  businessId: string,
  locationId: string,
  query: ListKitchenTicketsQuery,
): Promise<KitchenTicket[]> => {
  return findActiveKitchenTickets(
    businessId,
    locationId,
    query.preparationAreaId,
  );
};

export { listKitchenTickets };
