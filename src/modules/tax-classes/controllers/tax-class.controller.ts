import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  createTaxClassSchema,
  createTaxRateSchema,
  taxClassIdParamsSchema,
  updateTaxClassSchema,
  updateTaxClassStatusSchema,
} from "../schemas/tax-class.schema";
import {
  addTaxRate,
  changeTaxClassStatus,
  createTaxClass,
  getTaxClass,
  listTaxClasses,
  updateTaxClass,
} from "../services/tax-class.service";

const requireBusinessId = (request: Parameters<RequestHandler>[0]): string => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth.businessId;
};

const listTaxClassesController: RequestHandler = async (request, response) => {
  const businessId = requireBusinessId(request);
  const taxClasses = await listTaxClasses(businessId);

  response.status(200).json({
    status: "success",
    data: {
      taxClasses,
    },
  });
};

const getTaxClassController: RequestHandler = async (request, response) => {
  const businessId = requireBusinessId(request);
  const { taxClassId } = taxClassIdParamsSchema.parse(request.params);

  const taxClass = await getTaxClass(businessId, taxClassId);

  response.status(200).json({
    status: "success",
    data: {
      taxClass,
    },
  });
};

const createTaxClassController: RequestHandler = async (request, response) => {
  const businessId = requireBusinessId(request);
  const input = createTaxClassSchema.parse(request.body);

  const taxClass = await createTaxClass(businessId, input);

  response.status(201).json({
    status: "success",
    data: {
      taxClass,
    },
  });
};

const updateTaxClassController: RequestHandler = async (request, response) => {
  const businessId = requireBusinessId(request);
  const { taxClassId } = taxClassIdParamsSchema.parse(request.params);
  const input = updateTaxClassSchema.parse(request.body);

  const taxClass = await updateTaxClass(businessId, taxClassId, input);

  response.status(200).json({
    status: "success",
    data: {
      taxClass,
    },
  });
};

const updateTaxClassStatusController: RequestHandler = async (
  request,
  response,
) => {
  const businessId = requireBusinessId(request);
  const { taxClassId } = taxClassIdParamsSchema.parse(request.params);
  const input = updateTaxClassStatusSchema.parse(request.body);

  const taxClass = await changeTaxClassStatus(businessId, taxClassId, input);

  response.status(200).json({
    status: "success",
    data: {
      taxClass,
    },
  });
};

const createTaxRateController: RequestHandler = async (request, response) => {
  const businessId = requireBusinessId(request);
  const { taxClassId } = taxClassIdParamsSchema.parse(request.params);
  const input = createTaxRateSchema.parse(request.body);

  const taxClass = await addTaxRate(businessId, taxClassId, input);

  response.status(201).json({
    status: "success",
    data: {
      taxClass,
    },
  });
};

export {
  createTaxClassController,
  createTaxRateController,
  getTaxClassController,
  listTaxClassesController,
  updateTaxClassController,
  updateTaxClassStatusController,
};
