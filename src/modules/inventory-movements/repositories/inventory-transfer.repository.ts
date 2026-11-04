import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import { AppError } from "../../../shared/errors/app-error";

import type {
  CreateInventoryTransferData,
  InventoryTransfer,
} from "../inventory-transfer.types";

import {
  applyLocationInventoryMovement,
  type ApplyLocationInventoryMovementResult,
} from "./location-inventory-ledger.repository";

type LocationRow = RowDataPacket & {
  id: string;
  code: string;
  name: string;
  isActive: number;
  isInventoryLocation: number;
};

type TransferredCostRow = RowDataPacket & {
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: string;

  quantity: string;
  unitCost: string;
  totalCost: string;
  notes: string | null;
};

type TransferTimestampRow = RowDataPacket & {
  createdAt: Date;
  completedAt: Date;
};

type TransferStage = "SOURCE" | "DESTINATION";

const throwLedgerError = (
  result: Exclude<
    ApplyLocationInventoryMovementResult,
    Readonly<{ kind: "APPLIED"; movementId: string }>
  >,
  stage: TransferStage,
): never => {
  const locationLabel = stage === "SOURCE" ? "origen" : "destino";

  switch (result.kind) {
    case "LOCATION_NOT_FOUND":
      throw new AppError(
        `La ubicación de ${locationLabel} no existe`,
        404,
        `TRANSFER_${stage}_LOCATION_NOT_FOUND`,
      );

    case "LOCATION_INACTIVE":
      throw new AppError(
        `La ubicación de ${locationLabel} está inactiva`,
        409,
        `TRANSFER_${stage}_LOCATION_INACTIVE`,
      );

    case "LOCATION_NOT_INVENTORY_ENABLED":
      throw new AppError(
        `La ubicación de ${locationLabel} no administra inventario`,
        409,
        `TRANSFER_${stage}_LOCATION_NOT_INVENTORY_ENABLED`,
      );

    case "ITEM_NOT_AVAILABLE":
      throw new AppError(
        `El artículo ${result.inventoryItemId} no existe o está inactivo`,
        409,
        "INVENTORY_ITEM_NOT_AVAILABLE",
      );

    case "UNVALUED_STOCK":
      throw new AppError(
        `El artículo ${result.inventoryItemId} tiene existencias sin valorar`,
        409,
        "UNVALUED_INVENTORY_STOCK",
      );

    case "INSUFFICIENT_STOCK":
      throw new AppError(
        `Stock insuficiente para el artículo ${result.inventoryItemId}. ` +
          `Disponible: ${result.availableQuantity}. ` +
          `Solicitado: ${result.requestedQuantity}.`,
        409,
        "INSUFFICIENT_INVENTORY_STOCK",
      );

    case "UNIT_COST_REQUIRED":
      throw new AppError(
        `No fue posible trasladar el costo del artículo ${result.inventoryItemId}`,
        409,
        "TRANSFER_UNIT_COST_REQUIRED",
      );
  }
};

const createInventoryTransferRecord = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryTransferData,
): Promise<InventoryTransfer> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    /*
     * Bloqueamos las ubicaciones siempre en el mismo orden para reducir
     * el riesgo de interbloqueos entre transferencias simultáneas.
     */
    const orderedLocationIds = [
      data.sourceLocationId,
      data.destinationLocationId,
    ].sort((first, second) => {
      const firstId = BigInt(first);
      const secondId = BigInt(second);

      if (firstId < secondId) {
        return -1;
      }

      if (firstId > secondId) {
        return 1;
      }

      return 0;
    });

    const [locationRows] = await connection.execute<LocationRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          code,
          name,
          is_active AS isActive,
          is_inventory_location AS isInventoryLocation
        FROM business_locations
        WHERE
          business_id = ?
          AND id IN (?, ?)
        ORDER BY id ASC
        FOR UPDATE
      `,
      [businessId, ...orderedLocationIds],
    );

    const locationById = new Map(
      locationRows.map((location) => [location.id, location]),
    );

    const sourceLocation = locationById.get(data.sourceLocationId);
    const destinationLocation = locationById.get(data.destinationLocationId);

    if (!sourceLocation) {
      throw new AppError(
        "La ubicación de origen no existe",
        404,
        "TRANSFER_SOURCE_LOCATION_NOT_FOUND",
      );
    }

    if (!destinationLocation) {
      throw new AppError(
        "La ubicación de destino no existe",
        404,
        "TRANSFER_DESTINATION_LOCATION_NOT_FOUND",
      );
    }

    if (sourceLocation.isActive !== 1) {
      throw new AppError(
        "La ubicación de origen está inactiva",
        409,
        "TRANSFER_SOURCE_LOCATION_INACTIVE",
      );
    }

    if (destinationLocation.isActive !== 1) {
      throw new AppError(
        "La ubicación de destino está inactiva",
        409,
        "TRANSFER_DESTINATION_LOCATION_INACTIVE",
      );
    }

    if (sourceLocation.isInventoryLocation !== 1) {
      throw new AppError(
        "La ubicación de origen no administra inventario",
        409,
        "TRANSFER_SOURCE_LOCATION_NOT_INVENTORY_ENABLED",
      );
    }

    if (destinationLocation.isInventoryLocation !== 1) {
      throw new AppError(
        "La ubicación de destino no administra inventario",
        409,
        "TRANSFER_DESTINATION_LOCATION_NOT_INVENTORY_ENABLED",
      );
    }

    const [transferResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO inventory_transfers (
          business_id,
          source_location_id,
          destination_location_id,
          status,
          external_reference,
          notes,
          created_by_membership_id
        )
        VALUES (?, ?, ?, 'PROCESSING', ?, ?, ?)
      `,
      [
        businessId,
        data.sourceLocationId,
        data.destinationLocationId,
        data.externalReference,
        data.notes,
        membershipId,
      ],
    );

    const transferId = transferResult.insertId.toString();

    /*
     * Primero retiramos del origen. El motor calcula el costo exacto
     * que sale de esa ubicación.
     */
    const sourceResult = await applyLocationInventoryMovement(
      connection,
      businessId,
      membershipId,
      {
        locationId: data.sourceLocationId,
        movementType: "TRANSFER",
        returnKind: null,

        sourceType: "INVENTORY_TRANSFER_OUT",
        sourceId: transferId,

        externalReference: data.externalReference,

        notes:
          `Transferencia #${transferId} hacia ` +
          `${destinationLocation.name} (${destinationLocation.code})`,

        lines: data.lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          direction: "OUT" as const,
          quantity: line.quantity,
          unitCost: null,
          totalCost: null,
          notes: line.notes,
        })),
      },
    );

    if (sourceResult.kind !== "APPLIED") {
      return throwLedgerError(sourceResult, "SOURCE");
    }

    /*
     * Recuperamos el costo exacto retirado. Ese mismo valor debe ingresar
     * al destino para que la transferencia no cree ni destruya valor.
     */
    const [transferredCostRows] = await connection.execute<
      TransferredCostRow[]
    >(
      `
          SELECT
            CAST(iml.inventory_item_id AS CHAR) AS inventoryItemId,
            ii.name AS inventoryItemName,
            ii.base_unit AS baseUnit,

            CAST(iml.quantity AS CHAR) AS quantity,
            CAST(iml.unit_cost AS CHAR) AS unitCost,
            CAST(iml.total_cost AS CHAR) AS totalCost,

            iml.notes
          FROM inventory_movement_lines AS iml
          INNER JOIN inventory_items AS ii
            ON ii.business_id = iml.business_id
            AND ii.id = iml.inventory_item_id
          WHERE
            iml.business_id = ?
            AND iml.movement_id = ?
          ORDER BY iml.id ASC
          FOR UPDATE
        `,
      [businessId, sourceResult.movementId],
    );

    if (transferredCostRows.length !== data.lines.length) {
      throw new Error(
        "No fue posible recuperar todos los costos de la transferencia",
      );
    }

    /*
     * Ingresamos al destino con el costo total exacto retirado del origen.
     */
    const destinationResult = await applyLocationInventoryMovement(
      connection,
      businessId,
      membershipId,
      {
        locationId: data.destinationLocationId,
        movementType: "TRANSFER",
        returnKind: null,

        sourceType: "INVENTORY_TRANSFER_IN",
        sourceId: transferId,

        externalReference: data.externalReference,

        notes:
          `Transferencia #${transferId} recibida desde ` +
          `${sourceLocation.name} (${sourceLocation.code})`,

        lines: transferredCostRows.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          direction: "IN" as const,
          quantity: line.quantity,

          /*
           * totalCost conserva exactamente el valor retirado.
           * El motor calculará el nuevo promedio ponderado del destino.
           */
          unitCost: null,
          totalCost: line.totalCost,

          notes: line.notes,
        })),
      },
    );

    if (destinationResult.kind !== "APPLIED") {
      return throwLedgerError(destinationResult, "DESTINATION");
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE inventory_transfers
        SET
          source_movement_id = ?,
          destination_movement_id = ?,
          status = 'COMPLETED',
          completed_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'PROCESSING'
      `,
      [
        sourceResult.movementId,
        destinationResult.movementId,
        businessId,
        transferId,
      ],
    );

    const [timestampRows] = await connection.execute<TransferTimestampRow[]>(
      `
        SELECT
          created_at AS createdAt,
          completed_at AS completedAt
        FROM inventory_transfers
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
      `,
      [businessId, transferId],
    );

    const timestamps = timestampRows[0];

    if (!timestamps) {
      throw new Error("No fue posible recuperar la transferencia creada");
    }

    const transfer: InventoryTransfer = {
      id: transferId,
      businessId,

      sourceLocation: {
        id: sourceLocation.id,
        code: sourceLocation.code,
        name: sourceLocation.name,
      },

      destinationLocation: {
        id: destinationLocation.id,
        code: destinationLocation.code,
        name: destinationLocation.name,
      },

      sourceMovementId: sourceResult.movementId,
      destinationMovementId: destinationResult.movementId,

      status: "COMPLETED",

      externalReference: data.externalReference,
      notes: data.notes,

      createdByMembershipId: membershipId,
      createdAt: timestamps.createdAt,
      completedAt: timestamps.completedAt,

      lines: transferredCostRows.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        inventoryItemName: line.inventoryItemName,
        baseUnit: line.baseUnit,

        quantity: line.quantity,
        unitCost: line.unitCost,
        totalCost: line.totalCost,

        notes: line.notes,
      })),
    };

    await connection.commit();

    return transfer;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createInventoryTransferRecord };
