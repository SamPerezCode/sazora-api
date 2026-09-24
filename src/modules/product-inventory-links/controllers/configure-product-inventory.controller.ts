import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  configureProductInventoryParamsSchema,
  configureProductInventorySchema,
} from "../schemas/configure-product-inventory.schema";
import { configureProductInventory } from "../services/configure-product-inventory.service";

const configureProductInventoryController: RequestHandler = async (
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

  const { productId } = configureProductInventoryParamsSchema.parse(
    request.params,
  );

  const input = configureProductInventorySchema.parse(request.body);

  const setup = await configureProductInventory(
    request.auth.businessId,
    request.auth.membershipId,
    productId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      setup,
    },
  });
};

export { configureProductInventoryController };
