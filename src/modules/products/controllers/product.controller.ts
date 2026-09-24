import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { createProductSchema } from "../schemas/create-product.schema";
import {
  productIdParamsSchema,
  updateProductSchema,
} from "../schemas/update-product.schema";
import { updateProductStatusSchema } from "../schemas/update-product-status.schema";
import { updateProduct } from "../services/update-product.service";
import { createProduct } from "../services/create-product.service";
import { listProducts } from "../services/list-products.service";
import { changeProductStatus } from "../services/update-product-status.service";
import { getProduct } from "../services/get-product.service";
import { removeProductImageReference } from "../services/remove-product-image.service";
import { replaceProductImage } from "../services/update-product-image.service";

const createProductController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const input = createProductSchema.parse(request.body);

  const product = await createProduct(
    request.auth.businessId,
    input,
    request.file?.buffer,
  );

  response.status(201).json({
    status: "success",
    data: {
      product,
    },
  });
};

const listProductsController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const products = await listProducts(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      products,
    },
  });
};

const getProductController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { productId } = productIdParamsSchema.parse(request.params);

  const product = await getProduct(request.auth.businessId, productId);

  response.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
};

const updateProductController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { productId } = productIdParamsSchema.parse(request.params);
  const input = updateProductSchema.parse(request.body);

  const product = await updateProduct(
    request.auth.businessId,
    productId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
};

const updateProductStatusController: RequestHandler = async (
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

  const { productId } = productIdParamsSchema.parse(request.params);
  const input = updateProductStatusSchema.parse(request.body);

  const product = await changeProductStatus(
    request.auth.businessId,
    productId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
};

const updateProductImageController: RequestHandler = async (
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

  if (!request.file) {
    throw new AppError(
      "Debes enviar una imagen en el campo image",
      400,
      "IMAGE_REQUIRED",
    );
  }

  const { productId } = productIdParamsSchema.parse(request.params);

  const product = await replaceProductImage(
    request.auth.businessId,
    productId,
    request.file.buffer,
  );

  response.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
};

const removeProductImageController: RequestHandler = async (
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

  const { productId } = productIdParamsSchema.parse(request.params);

  const product = await removeProductImageReference(
    request.auth.businessId,
    productId,
  );

  response.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
};

export {
  createProductController,
  getProductController,
  listProductsController,
  removeProductImageController,
  updateProductController,
  updateProductImageController,
  updateProductStatusController,
};
