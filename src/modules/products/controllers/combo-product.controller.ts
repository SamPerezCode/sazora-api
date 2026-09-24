import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { createComboProductSchema } from "../schemas/create-combo-product.schema";
import {
  comboProductIdParamsSchema,
  updateComboProductSchema,
} from "../schemas/update-combo-product.schema";
import { createComboProduct } from "../services/create-combo-product.service";
import { getComboProduct } from "../services/get-combo-product.service";
import { updateComboProduct } from "../services/update-combo-product.service";

const requireAuth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const createComboProductController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const input = createComboProductSchema.parse(request.body);

  const combo = await createComboProduct(
    auth.businessId,
    input,
    request.file?.buffer,
  );

  response.status(201).json({
    status: "success",
    data: {
      combo,
    },
  });
};

const getComboProductController: RequestHandler = async (request, response) => {
  const auth = requireAuth(request);

  const { comboProductId } = comboProductIdParamsSchema.parse(request.params);

  const combo = await getComboProduct(auth.businessId, comboProductId);

  response.status(200).json({
    status: "success",
    data: {
      combo,
    },
  });
};

const updateComboProductController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { comboProductId } = comboProductIdParamsSchema.parse(request.params);

  const input = updateComboProductSchema.parse(request.body);

  const hasBodyChanges = Object.keys(input).length > 0;

  if (!hasBodyChanges && !request.file) {
    throw new AppError(
      "Debes enviar al menos un campo o una imagen",
      400,
      "COMBO_UPDATE_REQUIRED",
    );
  }

  const combo = await updateComboProduct(
    auth.businessId,
    comboProductId,
    input,
    request.file?.buffer,
  );

  response.status(200).json({
    status: "success",
    data: {
      combo,
    },
  });
};

export {
  createComboProductController,
  getComboProductController,
  updateComboProductController,
};
