import { emitOrderConfirmed } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import type { OrderDetail } from "../order.types";
import {
  confirmOrder as confirmOrderRecord,
  type CreatedKitchenTicket,
} from "../repositories/confirm-order.repository";
import { getOrder } from "./get-order.service";

type ConfirmOrderOutput = Readonly<{
  order: OrderDetail;
  kitchenTickets: readonly CreatedKitchenTicket[];
}>;

const confirmOrder = async (
  businessId: string,
  membershipId: string,
  orderId: string,
): Promise<ConfirmOrderOutput> => {
  const result = await confirmOrderRecord(businessId, membershipId, orderId);

  switch (result.kind) {
    case "CONFIRMED": {
      const order = await getOrder(businessId, orderId);

      emitOrderConfirmed({
        businessId,
        orderId: order.id,
        status: "CONFIRMED",
        confirmedAt: order.confirmedAt?.toISOString() ?? null,
        kitchenTickets: result.kitchenTickets,
      });

      return {
        order,
        kitchenTickets: result.kitchenTickets,
      };
    }

    case "ORDER_NOT_FOUND":
      throw new AppError("La orden no existe", 404, "ORDER_NOT_FOUND");

    case "ORDER_NOT_OPEN":
      throw new AppError(
        "Solo se pueden confirmar órdenes abiertas",
        409,
        "ORDER_NOT_OPEN",
      );

    case "ORDER_HAS_NO_ITEMS":
      throw new AppError(
        "No se puede confirmar una orden sin productos",
        409,
        "ORDER_HAS_NO_ITEMS",
      );

    case "PREPARATION_AREA_INACTIVE":
      throw new AppError(
        "Uno de los productos pertenece a un área de preparación desactivada",
        409,
        "PREPARATION_AREA_INACTIVE",
      );

    case "INVENTORY_ITEM_NOT_AVAILABLE":
      throw new AppError(
        `El artículo de inventario ${result.inventoryItemId} no existe o está inactivo`,
        409,
        "INVENTORY_ITEM_NOT_AVAILABLE",
      );
  }
};

export { confirmOrder };
export type { ConfirmOrderOutput };
