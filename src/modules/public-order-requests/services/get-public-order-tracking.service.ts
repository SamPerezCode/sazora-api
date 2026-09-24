import { AppError } from "../../../shared/errors/app-error";
import type { PublicOrderTracking } from "../public-order-request.types";
import { findPublicOrderTracking } from "../repositories/public-order-request.repository";

const getPublicOrderTracking = async (
  businessSlug: string,
  publicCode: string,
): Promise<PublicOrderTracking> => {
  const tracking = await findPublicOrderTracking(businessSlug, publicCode);

  if (!tracking) {
    throw new AppError(
      "No fue posible encontrar el pedido",
      404,
      "PUBLIC_ORDER_TRACKING_NOT_FOUND",
    );
  }

  return tracking;
};

export { getPublicOrderTracking };
