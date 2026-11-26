import type { RequestHandler } from "express";

import { emitInventoryChanged } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import {
  productInventoryCompositionParamsSchema,
  saveProductInventoryCompositionSchema,
} from "../schemas/product-inventory-composition.schema";
import { saveProductInventoryComposition } from "../services/product-inventory-composition.service";

const saveProductInventoryCompositionController: RequestHandler = async (
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

  const { productId } = productInventoryCompositionParamsSchema.parse(
    request.params,
  );

  const input = saveProductInventoryCompositionSchema.parse(request.body);

  const links = await saveProductInventoryComposition(
    request.auth.businessId,
    productId,
    input,
  );

  try {
    emitInventoryChanged(request.auth.businessId);
  } catch (error) {
    console.error(
      "La composición se guardó, pero no fue posible emitir el evento",
      error,
    );
  }

  response.status(200).json({
    status: "success",
    data: {
      productId,
      links,
    },
  });
};

export { saveProductInventoryCompositionController };
