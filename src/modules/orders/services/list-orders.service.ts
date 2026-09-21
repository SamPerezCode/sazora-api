import type { ListOrdersFilters, OrderListResult } from "../order.types";
import { findOrdersByBusinessId } from "../repositories/list-orders.repository";
import type { ListOrdersQuery } from "../schemas/list-orders.schema";

const listOrders = async (
  businessId: string,
  query: ListOrdersQuery,
): Promise<OrderListResult> => {
  const filters: ListOrdersFilters = {
    page: query.page,
    pageSize: query.pageSize,

    ...(query.status === undefined
      ? {}
      : {
          status: query.status,
        }),

    ...(query.serviceType === undefined
      ? {}
      : {
          serviceType: query.serviceType,
        }),
  };

  return findOrdersByBusinessId(businessId, filters);
};

export { listOrders };
