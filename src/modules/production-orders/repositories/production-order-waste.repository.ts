import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import { AppError } from "../../../shared/errors/app-error";

import { applyLocationInventoryMovement } from "../../inventory-movements/repositories/location-inventory-ledger.repository";

import type {
  CreateProductionOrderWasteData,
  CreateProductionOrderWasteResult,
  ProductionOrderWasteItemKind,
  ProductionOrderWasteLine,
  ProductionOrderWasteRecord,
} from "../production-order-waste.types";

import type { ProductionOrderStatus } from "../production-order.types";

type LockedProductionOrderRow = RowDataPacket & {
  id: string;
  locationId: string;
  status: ProductionOrderStatus;
  version: number;

  locationIsActive: number;
  isInventoryLocation: number;
  isProductionLocation: number;
};

type AllowedInventoryItemRow = RowDataPacket & {
  inventoryItemId: string;
  itemKind: ProductionOrderWasteItemKind;
};

type WasteRecordIdRow = RowDataPacket & {
  id: string;
};

type WasteRecordRow = RowDataPacket & {
  id: string;
  businessId: string;
  productionOrderId: string;
  inventoryMovementId: string;

  locationId: string;
  locationCode: string;
  locationName: string;

  reason: string;

  recordedByMembershipId: string;
  recordedByName: string;

  totalCost: string;
  createdAt: Date;
};

type WasteLineRow = RowDataPacket & {
  inventoryMovementLineId: string;

  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  baseUnit: string;

  itemKind: ProductionOrderWasteItemKind;

  quantity: string;
  unitCost: string | null;
  totalCost: string | null;

  balanceBefore: string;
  balanceAfter: string;

  notes: string | null;
};

const findProductionOrderWasteRecordById = async (
  businessId: string,
  productionOrderId: string,
  wasteRecordId: string,
): Promise<ProductionOrderWasteRecord | null> => {
  const [recordRows] = await databasePool.execute<WasteRecordRow[]>(
    `
        SELECT
          CAST(powr.id AS CHAR) AS id,

          CAST(powr.business_id AS CHAR)
            AS businessId,

          CAST(powr.production_order_id AS CHAR)
            AS productionOrderId,

          CAST(powr.inventory_movement_id AS CHAR)
            AS inventoryMovementId,

          CAST(po.location_id AS CHAR)
            AS locationId,

          bl.code AS locationCode,
          bl.name AS locationName,

          powr.reason,

          CAST(
            powr.recorded_by_membership_id AS CHAR
          ) AS recordedByMembershipId,

          responsible.full_name
            AS recordedByName,

          CAST(
            COALESCE(
              (
                SELECT SUM(iml.total_cost)
                FROM inventory_movement_lines AS iml
                WHERE
                  iml.business_id = powr.business_id
                  AND iml.movement_id =
                    powr.inventory_movement_id
              ),
              0.000000
            )
            AS CHAR
          ) AS totalCost,

          powr.created_at AS createdAt

        FROM production_order_waste_records AS powr

        INNER JOIN production_orders AS po
          ON po.business_id = powr.business_id
          AND po.id = powr.production_order_id

        INNER JOIN business_locations AS bl
          ON bl.business_id = po.business_id
          AND bl.id = po.location_id

        INNER JOIN business_memberships AS membership
          ON membership.business_id =
            powr.business_id
          AND membership.id =
            powr.recorded_by_membership_id

        INNER JOIN users AS responsible
          ON responsible.id = membership.user_id

        WHERE
          powr.business_id = ?
          AND powr.production_order_id = ?
          AND powr.id = ?

        LIMIT 1
      `,
    [businessId, productionOrderId, wasteRecordId],
  );

  const record = recordRows[0];

  if (!record) {
    return null;
  }

  const [lineRows] = await databasePool.execute<WasteLineRow[]>(
    `
        SELECT
          CAST(iml.id AS CHAR)
            AS inventoryMovementLineId,

          CAST(iml.inventory_item_id AS CHAR)
            AS inventoryItemId,

          ii.name AS inventoryItemName,
          ii.sku AS inventoryItemSku,
          ii.base_unit AS baseUnit,

          CASE
            WHEN poi.id IS NOT NULL THEN 'INPUT'
            ELSE 'OUTPUT'
          END AS itemKind,

          CAST(iml.quantity AS CHAR)
            AS quantity,

          CAST(iml.unit_cost AS CHAR)
            AS unitCost,

          CAST(iml.total_cost AS CHAR)
            AS totalCost,

          CAST(iml.balance_before AS CHAR)
            AS balanceBefore,

          CAST(iml.balance_after AS CHAR)
            AS balanceAfter,

          iml.notes

        FROM production_order_waste_records AS powr

        INNER JOIN inventory_movement_lines AS iml
          ON iml.business_id = powr.business_id
          AND iml.movement_id =
            powr.inventory_movement_id

        INNER JOIN inventory_items AS ii
          ON ii.business_id = iml.business_id
          AND ii.id = iml.inventory_item_id

        LEFT JOIN production_order_inputs AS poi
          ON poi.business_id = powr.business_id
          AND poi.production_order_id =
            powr.production_order_id
          AND poi.inventory_item_id =
            iml.inventory_item_id

        LEFT JOIN production_order_outputs AS poo
          ON poo.business_id = powr.business_id
          AND poo.production_order_id =
            powr.production_order_id
          AND poo.inventory_item_id =
            iml.inventory_item_id

        WHERE
          powr.business_id = ?
          AND powr.production_order_id = ?
          AND powr.id = ?
          AND (
            poi.id IS NOT NULL
            OR poo.id IS NOT NULL
          )

        ORDER BY iml.id ASC
      `,
    [businessId, productionOrderId, wasteRecordId],
  );

  const lines: ProductionOrderWasteLine[] = lineRows.map((line) => {
    if (line.unitCost === null || line.totalCost === null) {
      throw new Error("El movimiento de desperdicio no está valorizado");
    }

    return {
      inventoryMovementLineId: line.inventoryMovementLineId,

      inventoryItemId: line.inventoryItemId,
      inventoryItemName: line.inventoryItemName,

      inventoryItemSku: line.inventoryItemSku,

      baseUnit: line.baseUnit,
      itemKind: line.itemKind,

      quantity: line.quantity,
      unitCost: line.unitCost,
      totalCost: line.totalCost,

      balanceBefore: line.balanceBefore,
      balanceAfter: line.balanceAfter,

      notes: line.notes,
    };
  });

  return {
    id: record.id,
    businessId: record.businessId,

    productionOrderId: record.productionOrderId,

    inventoryMovementId: record.inventoryMovementId,

    locationId: record.locationId,
    locationCode: record.locationCode,
    locationName: record.locationName,

    reason: record.reason,

    recordedByMembershipId: record.recordedByMembershipId,

    recordedByName: record.recordedByName,

    totalCost: record.totalCost,
    createdAt: record.createdAt,

    lines,
  };
};

const findProductionOrderWasteRecords = async (
  businessId: string,
  productionOrderId: string,
): Promise<ProductionOrderWasteRecord[]> => {
  const [rows] = await databasePool.execute<WasteRecordIdRow[]>(
    `
        SELECT CAST(id AS CHAR) AS id
        FROM production_order_waste_records
        WHERE
          business_id = ?
          AND production_order_id = ?
        ORDER BY
          created_at DESC,
          id DESC
      `,
    [businessId, productionOrderId],
  );

  const records: ProductionOrderWasteRecord[] = [];

  for (const row of rows) {
    const record = await findProductionOrderWasteRecordById(
      businessId,
      productionOrderId,
      row.id,
    );

    if (record) {
      records.push(record);
    }
  }

  return records;
};

const createProductionOrderWasteRecord = async (
  businessId: string,
  membershipId: string,
  productionOrderId: string,
  data: CreateProductionOrderWasteData,
): Promise<CreateProductionOrderWasteResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    /*
     * La orden se bloquea antes de consultar existencias.
     * Así no puede completarse mientras se registra
     * un desperdicio.
     */
    const [orderRows] = await connection.execute<LockedProductionOrderRow[]>(
      `
          SELECT
            CAST(po.id AS CHAR) AS id,

            CAST(po.location_id AS CHAR)
              AS locationId,

            po.status,
            po.version,

            bl.is_active AS locationIsActive,

            bl.is_inventory_location
              AS isInventoryLocation,

            bl.is_production_location
              AS isProductionLocation

          FROM production_orders AS po

          INNER JOIN business_locations AS bl
            ON bl.business_id = po.business_id
            AND bl.id = po.location_id

          WHERE
            po.business_id = ?
            AND po.id = ?

          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productionOrderId],
    );

    const order = orderRows[0];

    if (!order) {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_FOUND",
      };
    }

    if (order.version !== data.version) {
      await connection.rollback();

      return {
        kind: "VERSION_CONFLICT",
      };
    }

    if (order.status !== "IN_PROGRESS") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_IN_PROGRESS",
      };
    }

    if (order.locationIsActive !== 1) {
      throw new AppError(
        "La planta de producción está inactiva",
        409,
        "LOCATION_INACTIVE",
      );
    }

    if (order.isInventoryLocation !== 1) {
      throw new AppError(
        "La planta no está habilitada para inventario",
        409,
        "LOCATION_NOT_INVENTORY_ENABLED",
      );
    }

    if (order.isProductionLocation !== 1) {
      throw new AppError(
        "La ubicación no está habilitada para producción",
        409,
        "LOCATION_NOT_PRODUCTION_ENABLED",
      );
    }

    /*
     * Solamente se pueden desperdiciar artículos que
     * pertenezcan a los insumos o resultados de la orden.
     */
    const [allowedItemRows] = await connection.execute<
      AllowedInventoryItemRow[]
    >(
      `
          SELECT
            CAST(poi.inventory_item_id AS CHAR)
              AS inventoryItemId,

            'INPUT' AS itemKind

          FROM production_order_inputs AS poi

          WHERE
            poi.business_id = ?
            AND poi.production_order_id = ?

          UNION ALL

          SELECT
            CAST(poo.inventory_item_id AS CHAR)
              AS inventoryItemId,

            'OUTPUT' AS itemKind

          FROM production_order_outputs AS poo

          WHERE
            poo.business_id = ?
            AND poo.production_order_id = ?
        `,
      [businessId, productionOrderId, businessId, productionOrderId],
    );

    const allowedItemIds = new Set(
      allowedItemRows.map((item) => item.inventoryItemId),
    );

    const hasInvalidItem = data.lines.some(
      (line) => !allowedItemIds.has(line.inventoryItemId),
    );

    if (hasInvalidItem) {
      await connection.rollback();

      return {
        kind: "LINES_MISMATCH",
      };
    }

    const movementResult = await applyLocationInventoryMovement(
      connection,
      businessId,
      membershipId,
      {
        locationId: order.locationId,

        movementType: "WASTE",
        returnKind: null,

        sourceType: "PRODUCTION_ORDER_WASTE",

        sourceId: productionOrderId,

        externalReference: `OP-${productionOrderId}-WASTE`,

        notes: data.reason,

        lines: data.lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,

          direction: "OUT" as const,
          quantity: line.quantity,

          /*
           * Las salidas siempre utilizan el costo
           * promedio vigente de la ubicación.
           */
          unitCost: null,
          totalCost: null,

          notes: line.notes,
        })),
      },
    );

    switch (movementResult.kind) {
      case "APPLIED":
        break;

      case "ITEM_NOT_AVAILABLE":
        throw new AppError(
          `El artículo ${movementResult.inventoryItemId} no existe o está inactivo`,
          409,
          "INVENTORY_ITEM_NOT_AVAILABLE",
        );

      case "INSUFFICIENT_STOCK":
        throw new AppError(
          `Stock insuficiente para registrar el desperdicio del artículo ${movementResult.inventoryItemId}. ` +
            `Disponible: ${movementResult.availableQuantity}. ` +
            `Solicitado: ${movementResult.requestedQuantity}.`,
          409,
          "INSUFFICIENT_INVENTORY_STOCK",
        );

      case "UNVALUED_STOCK":
        throw new AppError(
          `El artículo ${movementResult.inventoryItemId} tiene existencias sin valorar`,
          409,
          "UNVALUED_INVENTORY_STOCK",
        );

      case "UNIT_COST_REQUIRED":
        throw new AppError(
          `No fue posible determinar el costo del artículo ${movementResult.inventoryItemId}`,
          409,
          "INVENTORY_UNIT_COST_REQUIRED",
        );

      case "LOCATION_NOT_FOUND":
        throw new AppError(
          "La planta de producción no existe",
          404,
          "LOCATION_NOT_FOUND",
        );

      case "LOCATION_INACTIVE":
        throw new AppError(
          "La planta de producción está inactiva",
          409,
          "LOCATION_INACTIVE",
        );

      case "LOCATION_NOT_INVENTORY_ENABLED":
        throw new AppError(
          "La planta no está habilitada para inventario",
          409,
          "LOCATION_NOT_INVENTORY_ENABLED",
        );
    }

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO production_order_waste_records (
            business_id,
            production_order_id,
            inventory_movement_id,
            reason,
            recorded_by_membership_id
          )
          VALUES (?, ?, ?, ?, ?)
        `,
      [
        businessId,
        productionOrderId,
        movementResult.movementId,
        data.reason,
        membershipId,
      ],
    );

    const wasteRecordId = insertResult.insertId.toString();

    /*
     * El cambio de versión evita que una pantalla con
     * datos anteriores complete la orden después de
     * registrar el desperdicio.
     */
    await connection.execute<ResultSetHeader>(
      `
        UPDATE production_orders
        SET
          updated_by_membership_id = ?,
          version = version + 1
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'IN_PROGRESS'
      `,
      [membershipId, businessId, productionOrderId],
    );

    await connection.commit();

    const wasteRecord = await findProductionOrderWasteRecordById(
      businessId,
      productionOrderId,
      wasteRecordId,
    );

    if (!wasteRecord) {
      throw new Error("No fue posible recuperar el desperdicio registrado");
    }

    return {
      kind: "CREATED",
      wasteRecord,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  createProductionOrderWasteRecord,
  findProductionOrderWasteRecordById,
  findProductionOrderWasteRecords,
};
