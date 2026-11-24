import { AppError } from "../../../shared/errors/app-error";
import type { CommercialCustomerDetail } from "../commercial-customer.types";
import {
  updateCommercialCustomerConsent,
  updateCommercialCustomerStatus,
} from "../repositories/commercial-customer.repository";
import type {
  UpdateCommercialCustomerConsentInput,
  UpdateCommercialCustomerStatusInput,
} from "../schemas/commercial-customer.schema";

const changeCommercialCustomerConsent = async (
  businessId: string,
  customerId: string,
  input: UpdateCommercialCustomerConsentInput,
): Promise<CommercialCustomerDetail> => {
  const customer = await updateCommercialCustomerConsent(
    businessId,
    customerId,
    input.marketingConsent,
  );

  if (!customer) {
    throw new AppError(
      "El cliente comercial no existe",
      404,
      "COMMERCIAL_CUSTOMER_NOT_FOUND",
    );
  }

  return customer;
};

const changeCommercialCustomerStatus = async (
  businessId: string,
  customerId: string,
  input: UpdateCommercialCustomerStatusInput,
): Promise<CommercialCustomerDetail> => {
  const customer = await updateCommercialCustomerStatus(
    businessId,
    customerId,
    input.isActive,
  );

  if (!customer) {
    throw new AppError(
      "El cliente comercial no existe",
      404,
      "COMMERCIAL_CUSTOMER_NOT_FOUND",
    );
  }

  return customer;
};

export { changeCommercialCustomerConsent, changeCommercialCustomerStatus };
