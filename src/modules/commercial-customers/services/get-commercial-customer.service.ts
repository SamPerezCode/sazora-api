import { AppError } from "../../../shared/errors/app-error";
import type { CommercialCustomerDetail } from "../commercial-customer.types";
import { findCommercialCustomerById } from "../repositories/commercial-customer.repository";

const getCommercialCustomer = async (
  businessId: string,
  customerId: string,
): Promise<CommercialCustomerDetail> => {
  const customer = await findCommercialCustomerById(businessId, customerId);

  if (!customer) {
    throw new AppError(
      "El cliente comercial no existe",
      404,
      "COMMERCIAL_CUSTOMER_NOT_FOUND",
    );
  }

  return customer;
};

export { getCommercialCustomer };
