import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  commercialCustomerHistoryQuerySchema,
  commercialCustomerIdParamsSchema,
  listCommercialCustomersQuerySchema,
} from "../schemas/commercial-customer.schema";
import {
  getCommercialCustomerOrders,
  getCommercialCustomerSales,
} from "../services/get-commercial-customer-history.service";
import { listCommercialCustomers } from "../services/list-commercial-customers.service";
import { getCommercialCustomer } from "../services/get-commercial-customer.service";

const listCommercialCustomersController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const query = listCommercialCustomersQuerySchema.parse(request.query);

  const result = await listCommercialCustomers(request.auth.businessId, query);

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const getCommercialCustomerController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { customerId } = commercialCustomerIdParamsSchema.parse(request.params);

  const customer = await getCommercialCustomer(
    request.auth.businessId,
    customerId,
  );

  response.status(200).json({
    status: "success",
    data: {
      customer,
    },
  });
};

const getCommercialCustomerOrdersController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { customerId } = commercialCustomerIdParamsSchema.parse(request.params);

  const query = commercialCustomerHistoryQuerySchema.parse(request.query);

  const result = await getCommercialCustomerOrders(
    request.auth.businessId,
    customerId,
    query,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const getCommercialCustomerSalesController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { customerId } = commercialCustomerIdParamsSchema.parse(request.params);

  const query = commercialCustomerHistoryQuerySchema.parse(request.query);

  const result = await getCommercialCustomerSales(
    request.auth.businessId,
    customerId,
    query,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

export {
  getCommercialCustomerController,
  getCommercialCustomerOrdersController,
  getCommercialCustomerSalesController,
  listCommercialCustomersController,
};
