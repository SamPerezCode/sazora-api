import type { OrderListResult } from "../../orders/order.types";
import { findOrdersByBusinessId } from "../../orders/repositories/list-orders.repository";
import type { SaleListResult } from "../../sales/sale.types";
import { findSales } from "../../sales/repositories/list-sales.repository";
import type { CommercialCustomerHistoryQuery } from "../schemas/commercial-customer.schema";
import { getCommercialCustomer } from "./get-commercial-customer.service";

const getCommercialCustomerOrders = async (
  businessId: string,
  customerId: string,
  query: CommercialCustomerHistoryQuery,
): Promise<OrderListResult> => {
  await getCommercialCustomer(businessId, customerId);

  return findOrdersByBusinessId(businessId, {
    commercialCustomerId: customerId,
    page: query.page,
    pageSize: query.pageSize,
  });
};

const getCommercialCustomerSales = async (
  businessId: string,
  customerId: string,
  query: CommercialCustomerHistoryQuery,
): Promise<SaleListResult> => {
  await getCommercialCustomer(businessId, customerId);

  return findSales(businessId, {
    commercialCustomerId: customerId,
    page: query.page,
    pageSize: query.pageSize,
  });
};

export { getCommercialCustomerOrders, getCommercialCustomerSales };
