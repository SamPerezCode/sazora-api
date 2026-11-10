import type { PoolConnection } from "mysql2/promise";

import { AppError } from "../../../shared/errors/app-error";
import type { ReserveOrderItemInventoryData } from "../inventory-reservation.types";
import { reserveOrderItemInventory } from "./inventory-reservation.repository";

const reserveOrderItemInventoryOrThrow = async (
  connection: PoolConnection,
  businessId: string,
  data: ReserveOrderItemInventoryData,
): Promise<void> => {
  const result = await reserveOrderItemInventory(connection, businessId, data);

  switch (result.kind) {
    case "RESERVED":
      return;

    case "INVENTORY_ITEM_UNAVAILABLE":
      throw new AppError(
        `El artículo de inventario «${result.inventoryItemName}» no está disponible`,
        409,
        "INVENTORY_ITEM_NOT_AVAILABLE",
      );

    case "INSUFFICIENT_AVAILABLE_STOCK":
      throw new AppError(
        `Stock disponible insuficiente para «${result.inventoryItemName}». ` +
          `Existencia: ${result.currentStock}. ` +
          `Reservado: ${result.reservedQuantity}. ` +
          `Disponible: ${result.availableQuantity}. ` +
          `Solicitado: ${result.requestedQuantity}.`,
        409,
        "INSUFFICIENT_INVENTORY_STOCK",
      );

    case "RESERVATION_ALREADY_CONSUMED":
      throw new AppError(
        `La reserva del artículo ${result.inventoryItemId} ya fue consumida`,
        409,
        "INVENTORY_RESERVATION_ALREADY_CONSUMED",
      );
  }
};

export { reserveOrderItemInventoryOrThrow };
