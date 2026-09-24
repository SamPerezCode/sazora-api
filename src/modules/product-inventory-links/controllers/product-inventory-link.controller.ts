import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  createProductInventoryLinkSchema,
  productInventoryLinkIdParamsSchema,
  updateProductInventoryLinkSchema,
  updateProductInventoryLinkStatusSchema,
} from "../schemas/product-inventory-link.schema";
import {
  createProductInventoryLink,
  getProductInventoryLink,
  listProductInventoryLinks,
  updateProductInventoryLink,
  updateProductInventoryLinkStatus,
} from "../services/product-inventory-link.service";

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

const listProductInventoryLinksController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const links = await listProductInventoryLinks(auth.businessId);

  response.status(200).json({
    status: "success",
    data: { links },
  });
};

const getProductInventoryLinkController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productInventoryLinkId } = productInventoryLinkIdParamsSchema.parse(
    request.params,
  );

  const link = await getProductInventoryLink(
    auth.businessId,
    productInventoryLinkId,
  );

  response.status(200).json({
    status: "success",
    data: { link },
  });
};

const createProductInventoryLinkController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const input = createProductInventoryLinkSchema.parse(request.body);

  const link = await createProductInventoryLink(auth.businessId, input);

  response.status(201).json({
    status: "success",
    data: { link },
  });
};

const updateProductInventoryLinkController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productInventoryLinkId } = productInventoryLinkIdParamsSchema.parse(
    request.params,
  );

  const input = updateProductInventoryLinkSchema.parse(request.body);

  const link = await updateProductInventoryLink(
    auth.businessId,
    productInventoryLinkId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: { link },
  });
};

const updateProductInventoryLinkStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuth(request);

  const { productInventoryLinkId } = productInventoryLinkIdParamsSchema.parse(
    request.params,
  );

  const { isActive } = updateProductInventoryLinkStatusSchema.parse(
    request.body,
  );

  const link = await updateProductInventoryLinkStatus(
    auth.businessId,
    productInventoryLinkId,
    isActive,
  );

  response.status(200).json({
    status: "success",
    data: { link },
  });
};

export {
  createProductInventoryLinkController,
  getProductInventoryLinkController,
  listProductInventoryLinksController,
  updateProductInventoryLinkController,
  updateProductInventoryLinkStatusController,
};
