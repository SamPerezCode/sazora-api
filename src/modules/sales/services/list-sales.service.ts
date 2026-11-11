import { findSales } from "../repositories/list-sales.repository";
import type { ListSalesQuery } from "../schemas/list-sales.schema";
import type { ListSalesFilters, SaleListResult } from "../sale.types";

const listSales = async (
  businessId: string,
  query: ListSalesQuery,
  locationId?: string,
): Promise<SaleListResult> => {
  const filters: ListSalesFilters = {
    page: query.page,
    pageSize: query.pageSize,

    ...(locationId === undefined ? {} : { locationId }),

    ...(query.cashSessionId === undefined
      ? {}
      : { cashSessionId: query.cashSessionId }),

    ...(query.status === undefined ? {} : { status: query.status }),

    ...(query.from === undefined ? {} : { from: new Date(query.from) }),

    ...(query.to === undefined ? {} : { to: new Date(query.to) }),
  };

  return findSales(businessId, filters);
};

export { listSales };
