import type {
  CommercialCustomerListResult,
  ListCommercialCustomersFilters,
} from "../commercial-customer.types";
import { findCommercialCustomers } from "../repositories/commercial-customer.repository";
import type { ListCommercialCustomersQuery } from "../schemas/commercial-customer.schema";

const listCommercialCustomers = async (
  businessId: string,
  query: ListCommercialCustomersQuery,
): Promise<CommercialCustomerListResult> => {
  const filters: ListCommercialCustomersFilters = {
    page: query.page,
    pageSize: query.pageSize,

    ...(query.search === undefined
      ? {}
      : {
          search: query.search,
        }),

    ...(query.isActive === undefined
      ? {}
      : {
          isActive: query.isActive,
        }),
  };

  return findCommercialCustomers(businessId, filters);
};

export { listCommercialCustomers };
