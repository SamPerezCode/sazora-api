import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { productAvailabilityQuerySchema } from "../schemas/product-availability.schema";
import { getProductAvailabilityByLocation } from "../services/product-availability.service";

const getProductAvailabilityController: RequestHandler = async (
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

  const { locationId } = productAvailabilityQuerySchema.parse(request.query);

  const products = await getProductAvailabilityByLocation(
    request.auth.businessId,
    locationId,
  );

  response.status(200).json({
    status: "success",
    data: {
      locationId,
      products,
    },
  });
};

export { getProductAvailabilityController };
