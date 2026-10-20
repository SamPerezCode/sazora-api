import { emitInventoryChanged } from "../../../realtime/realtime.events";

import { AppError } from "../../../shared/errors/app-error";

import type { AuthenticatedSession } from "../../auth/auth.types";

import {
  createProductionOrderWasteRecord,
  findProductionOrderWasteRecordById,
  findProductionOrderWasteRecords,
} from "../repositories/production-order-waste.repository";

import type { ProductionOrderWasteRecord } from "../production-order-waste.types";

import type { ProductionOrder } from "../production-order.types";

import type { CreateProductionOrderWasteInput } from "../schemas/production-order-waste.schema";

import { getProductionOrder } from "./production-order.service";

type CreateProductionOrderWasteOutput = Readonly<{
  productionOrder: ProductionOrder;
  wasteRecord: ProductionOrderWasteRecord;
}>;

const listProductionOrderWaste = async (
  auth: AuthenticatedSession,
  productionOrderId: string,
): Promise<ProductionOrderWasteRecord[]> => {
  /*
   * Además de comprobar que la orden existe,
   * esta llamada valida que el usuario tenga
   * acceso a la planta correspondiente.
   */
  await getProductionOrder(auth, productionOrderId);

  return findProductionOrderWasteRecords(auth.businessId, productionOrderId);
};

const getProductionOrderWaste = async (
  auth: AuthenticatedSession,
  productionOrderId: string,
  wasteRecordId: string,
): Promise<ProductionOrderWasteRecord> => {
  await getProductionOrder(auth, productionOrderId);

  const wasteRecord = await findProductionOrderWasteRecordById(
    auth.businessId,
    productionOrderId,
    wasteRecordId,
  );

  if (!wasteRecord) {
    throw new AppError(
      "El registro de desperdicio no existe",
      404,
      "PRODUCTION_ORDER_WASTE_NOT_FOUND",
    );
  }

  return wasteRecord;
};

const createProductionOrderWaste = async (
  auth: AuthenticatedSession,
  productionOrderId: string,
  input: CreateProductionOrderWasteInput,
): Promise<CreateProductionOrderWasteOutput> => {
  const currentOrder = await getProductionOrder(auth, productionOrderId);

  if (currentOrder.status !== "IN_PROGRESS") {
    throw new AppError(
      "Solo se pueden registrar desperdicios en órdenes que estén en proceso",
      409,
      "PRODUCTION_ORDER_NOT_IN_PROGRESS",
    );
  }

  const result = await createProductionOrderWasteRecord(
    auth.businessId,
    auth.membershipId,
    productionOrderId,
    {
      version: input.version,
      reason: input.reason,

      lines: input.lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,

        quantity: line.quantity,
        notes: line.notes,
      })),
    },
  );

  switch (result.kind) {
    case "CREATED": {
      emitInventoryChanged(auth.businessId);

      /*
       * El registro incrementó la versión de la orden.
       * Devolvemos la orden actualizada para que el
       * frontend no conserve una versión obsoleta.
       */
      const productionOrder = await getProductionOrder(auth, productionOrderId);

      return {
        productionOrder,
        wasteRecord: result.wasteRecord,
      };
    }

    case "ORDER_NOT_FOUND":
      throw new AppError(
        "La orden de producción no existe",
        404,
        "PRODUCTION_ORDER_NOT_FOUND",
      );

    case "ORDER_NOT_IN_PROGRESS":
      throw new AppError(
        "Solo se pueden registrar desperdicios en órdenes que estén en proceso",
        409,
        "PRODUCTION_ORDER_NOT_IN_PROGRESS",
      );

    case "VERSION_CONFLICT":
      throw new AppError(
        "La orden fue modificada por otra persona. Actualiza la información e inténtalo nuevamente",
        409,
        "PRODUCTION_ORDER_VERSION_CONFLICT",
      );

    case "LINES_MISMATCH":
      throw new AppError(
        "Uno o más artículos no pertenecen a los insumos o resultados de esta orden",
        409,
        "PRODUCTION_ORDER_WASTE_LINES_MISMATCH",
      );
  }
};

export {
  createProductionOrderWaste,
  getProductionOrderWaste,
  listProductionOrderWaste,
};

export type { CreateProductionOrderWasteOutput };
