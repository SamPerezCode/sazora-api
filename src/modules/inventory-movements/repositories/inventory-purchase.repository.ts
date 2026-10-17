import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type { InventoryUnit } from "../../inventory-items/inventory-item.types";

import type {
  CreateInventoryPurchaseData,
  CreateInventoryPurchaseResult,
  InventoryPurchase,
  InventoryPurchaseLine,
} from "../inventory-purchase.types";

type LocationRow = RowDataPacket & {
  id: string;
  code: string;
  name: string;
  isActive: number;
  isInventoryLocation: number;
};

type LockedPresentationRow = RowDataPacket & {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: InventoryUnit;
  name: string;
  conversionFactor: string;
};

type LockedBalanceRow = RowDataPacket & {
  inventoryItemId: string;
  currentStock: string;
  averageUnitCost: string | null;
  inventoryValue: string | null;
  valuationStatus: "UNVALUED" | "VALUED";
};

type BaseQuantityRow = RowDataPacket & {
  baseQuantity: string;
};

type PurchaseCalculationRow = RowDataPacket & {
  unitCost: string;
  balanceAfter: string;
  inventoryValueAfter: string;
  averageUnitCostAfter: string;
};

type PurchaseHeaderRow = RowDataPacket & {
  id: string;
  businessId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  externalReference: string | null;
  notes: string | null;
  totalCost: string;
  createdByMembershipId: string;
  createdByName: string;
  createdAt: Date;
};

type PurchaseLineRow = RowDataPacket & {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnit: InventoryUnit;
  presentationId: string;
  presentationName: string;
  conversionFactor: string;
  purchasedQuantity: string;
  baseQuantity: string;
  unitCost: string;
  totalCost: string;
  balanceBefore: string;
  balanceAfter: string;
  averageUnitCostBefore: string | null;
  averageUnitCostAfter: string;
  inventoryValueBefore: string | null;
  inventoryValueAfter: string;
  notes: string | null;
};

const isZeroDecimal = (value: string): boolean =>
  /^[-+]?0+(?:\.0+)?$/.test(value.trim());

const isNegativeDecimal = (value: string): boolean =>
  value.trim().startsWith("-") && !isZeroDecimal(value);

const findInventoryPurchaseById = async (
  businessId: string,
  movementId: string,
): Promise<InventoryPurchase | null> => {
  const [headerRows] = await databasePool.execute<PurchaseHeaderRow[]>(
    `
      SELECT
        CAST(im.id AS CHAR) AS id,
        CAST(im.business_id AS CHAR) AS businessId,

        CAST(bl.id AS CHAR) AS locationId,
        bl.code AS locationCode,
        bl.name AS locationName,

        im.external_reference AS externalReference,
        im.notes,

        CAST(
          COALESCE(
            (
              SELECT SUM(iml.total_cost)
              FROM inventory_movement_lines AS iml
              WHERE
                iml.business_id = im.business_id
                AND iml.movement_id = im.id
            ),
            0
          )
          AS CHAR
        ) AS totalCost,

        CAST(im.created_by_membership_id AS CHAR)
          AS createdByMembershipId,

        u.full_name AS createdByName,
        im.created_at AS createdAt

      FROM inventory_movements AS im

      INNER JOIN business_locations AS bl
        ON bl.business_id = im.business_id
        AND bl.id = im.location_id

      INNER JOIN business_memberships AS bm
        ON bm.business_id = im.business_id
        AND bm.id = im.created_by_membership_id

      INNER JOIN users AS u
        ON u.id = bm.user_id

      WHERE
        im.business_id = ?
        AND im.id = ?
        AND im.movement_type = 'PURCHASE'

      LIMIT 1
    `,
    [businessId, movementId],
  );

  const header = headerRows[0];

  if (!header) {
    return null;
  }

  const [lineRows] = await databasePool.execute<PurchaseLineRow[]>(
    `
      SELECT
        CAST(iml.id AS CHAR) AS id,

        CAST(iml.inventory_item_id AS CHAR)
          AS inventoryItemId,

        ii.name AS inventoryItemName,
        ii.base_unit AS baseUnit,

        CAST(iml.purchase_presentation_id AS CHAR)
          AS presentationId,

        iml.purchase_presentation_name
          AS presentationName,

        CAST(iml.purchase_conversion_factor AS CHAR)
          AS conversionFactor,

        CAST(iml.purchased_quantity AS CHAR)
          AS purchasedQuantity,

        CAST(iml.quantity AS CHAR)
          AS baseQuantity,

        CAST(iml.unit_cost AS CHAR)
          AS unitCost,

        CAST(iml.total_cost AS CHAR)
          AS totalCost,

        CAST(iml.balance_before AS CHAR)
          AS balanceBefore,

        CAST(iml.balance_after AS CHAR)
          AS balanceAfter,

        CAST(iml.average_unit_cost_before AS CHAR)
          AS averageUnitCostBefore,

        CAST(iml.average_unit_cost_after AS CHAR)
          AS averageUnitCostAfter,

        CAST(iml.inventory_value_before AS CHAR)
          AS inventoryValueBefore,

        CAST(iml.inventory_value_after AS CHAR)
          AS inventoryValueAfter,

        iml.notes

      FROM inventory_movement_lines AS iml

      INNER JOIN inventory_items AS ii
        ON ii.business_id = iml.business_id
        AND ii.id = iml.inventory_item_id

      WHERE
        iml.business_id = ?
        AND iml.movement_id = ?

      ORDER BY iml.id ASC
    `,
    [businessId, movementId],
  );

  const lines: InventoryPurchaseLine[] = lineRows.map((line) => ({
    id: line.id,
    inventoryItemId: line.inventoryItemId,
    inventoryItemName: line.inventoryItemName,
    baseUnit: line.baseUnit,

    presentation: {
      id: line.presentationId,
      name: line.presentationName,
      conversionFactor: line.conversionFactor,
    },

    purchasedQuantity: line.purchasedQuantity,
    baseQuantity: line.baseQuantity,

    unitCost: line.unitCost,
    totalCost: line.totalCost,

    balanceBefore: line.balanceBefore,
    balanceAfter: line.balanceAfter,

    averageUnitCostBefore: line.averageUnitCostBefore,
    averageUnitCostAfter: line.averageUnitCostAfter,

    inventoryValueBefore: line.inventoryValueBefore,
    inventoryValueAfter: line.inventoryValueAfter,

    notes: line.notes,
  }));

  return {
    id: header.id,
    businessId: header.businessId,

    location: {
      id: header.locationId,
      code: header.locationCode,
      name: header.locationName,
    },

    externalReference: header.externalReference,
    notes: header.notes,
    totalCost: header.totalCost,

    createdByMembershipId: header.createdByMembershipId,
    createdByName: header.createdByName,
    createdAt: header.createdAt,

    lines,
  };
};

const createInventoryPurchaseRecord = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryPurchaseData,
): Promise<CreateInventoryPurchaseResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

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
          AND id = ?

        LIMIT 1
        FOR UPDATE
      `,
      [businessId, data.locationId],
    );

    const location = locationRows[0];

    if (!location) {
      await connection.rollback();
      return { kind: "LOCATION_NOT_FOUND" };
    }

    if (location.isActive === 0) {
      await connection.rollback();

      return {
        kind: "LOCATION_INACTIVE",
      };
    }

    if (location.isInventoryLocation === 0) {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_INVENTORY_ENABLED",
      };
    }

    const presentationIds = [...data.lines]
      .map((line) => line.presentationId)
      .sort((first, second) => (BigInt(first) < BigInt(second) ? -1 : 1));

    const presentationPlaceholders = presentationIds.map(() => "?").join(", ");

    const [presentationRows] = await connection.execute<
      LockedPresentationRow[]
    >(
      `
          SELECT
            CAST(ipp.id AS CHAR) AS id,

            CAST(ipp.inventory_item_id AS CHAR)
              AS inventoryItemId,

            ii.name AS inventoryItemName,
            ii.base_unit AS baseUnit,

            ipp.name,

            CAST(ipp.conversion_factor AS CHAR)
              AS conversionFactor

          FROM inventory_purchase_presentations AS ipp

          INNER JOIN inventory_items AS ii
            ON ii.business_id = ipp.business_id
            AND ii.id = ipp.inventory_item_id

          WHERE
            ipp.business_id = ?
            AND ipp.id IN (${presentationPlaceholders})
            AND ipp.is_active = TRUE
            AND ii.is_active = TRUE

          ORDER BY ipp.id ASC

          FOR UPDATE
        `,
      [businessId, ...presentationIds],
    );

    const presentationById = new Map(
      presentationRows.map((presentation) => [presentation.id, presentation]),
    );

    const unavailablePresentationIds = presentationIds.filter(
      (presentationId) => !presentationById.has(presentationId),
    );

    if (unavailablePresentationIds.length > 0) {
      await connection.rollback();

      return {
        kind: "PRESENTATIONS_NOT_AVAILABLE",
        presentationIds: unavailablePresentationIds,
      };
    }

    for (const line of data.lines) {
      const presentation = presentationById.get(line.presentationId);

      if (!presentation) {
        throw new Error("No fue posible recuperar una presentación validada");
      }

      if (presentation.inventoryItemId !== line.inventoryItemId) {
        await connection.rollback();

        return {
          kind: "PRESENTATION_ITEM_MISMATCH",
          presentationId: line.presentationId,
          inventoryItemId: line.inventoryItemId,
        };
      }
    }

    const itemIds = [...data.lines]
      .map((line) => line.inventoryItemId)
      .sort((first, second) => (BigInt(first) < BigInt(second) ? -1 : 1));

    for (const inventoryItemId of itemIds) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO inventory_location_balances (
            business_id,
            location_id,
            inventory_item_id,
            current_stock,
            minimum_stock,
            average_unit_cost,
            inventory_value,
            valuation_status,
            migrated_from_legacy
          )
          VALUES (
            ?,
            ?,
            ?,
            0.000,
            0.000,
            NULL,
            0.000000,
            'VALUED',
            FALSE
          )
          ON DUPLICATE KEY UPDATE
            inventory_item_id = VALUES(inventory_item_id)
        `,
        [businessId, data.locationId, inventoryItemId],
      );
    }

    const balancePlaceholders = itemIds.map(() => "?").join(", ");

    const [balanceRows] = await connection.execute<LockedBalanceRow[]>(
      `
        SELECT
          CAST(inventory_item_id AS CHAR)
            AS inventoryItemId,

          CAST(current_stock AS CHAR)
            AS currentStock,

          CAST(average_unit_cost AS CHAR)
            AS averageUnitCost,

          CAST(inventory_value AS CHAR)
            AS inventoryValue,

          valuation_status AS valuationStatus

        FROM inventory_location_balances

        WHERE
          business_id = ?
          AND location_id = ?
          AND inventory_item_id IN (${balancePlaceholders})

        ORDER BY inventory_item_id ASC

        FOR UPDATE
      `,
      [businessId, data.locationId, ...itemIds],
    );

    const balanceByItemId = new Map(
      balanceRows.map((balance) => [balance.inventoryItemId, balance]),
    );

    for (const line of data.lines) {
      const balance = balanceByItemId.get(line.inventoryItemId);

      if (!balance) {
        throw new Error("No fue posible recuperar el saldo de inventario");
      }

      if (isNegativeDecimal(balance.currentStock)) {
        await connection.rollback();

        return {
          kind: "NEGATIVE_STOCK",
          inventoryItemId: line.inventoryItemId,
          currentStock: balance.currentStock,
        };
      }

      if (
        !isZeroDecimal(balance.currentStock) &&
        balance.valuationStatus === "UNVALUED"
      ) {
        await connection.rollback();

        return {
          kind: "UNVALUED_STOCK",
          inventoryItemId: line.inventoryItemId,
        };
      }
    }

    const [movementResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO inventory_movements (
          business_id,
          location_id,
          movement_type,
          source_type,
          source_id,
          external_reference,
          notes,
          created_by_membership_id
        )
        VALUES (
          ?,
          ?,
          'PURCHASE',
          NULL,
          NULL,
          ?,
          ?,
          ?
        )
      `,
      [
        businessId,
        data.locationId,
        data.externalReference,
        data.notes,
        membershipId,
      ],
    );

    const movementId = movementResult.insertId.toString();

    for (const line of data.lines) {
      const presentation = presentationById.get(line.presentationId);
      const balance = balanceByItemId.get(line.inventoryItemId);

      if (!presentation || !balance) {
        throw new Error("No fue posible recuperar la información bloqueada");
      }

      const [baseQuantityRows] = await connection.execute<BaseQuantityRow[]>(
        `
            SELECT
              CAST(
                ROUND(
                  CAST(? AS DECIMAL(18, 3))
                  *
                  CAST(? AS DECIMAL(18, 6)),
                  3
                )
                AS CHAR
              ) AS baseQuantity
          `,
        [line.purchasedQuantity, presentation.conversionFactor],
      );

      const baseQuantity = baseQuantityRows[0]?.baseQuantity;

      if (!baseQuantity || isZeroDecimal(baseQuantity)) {
        await connection.rollback();

        return {
          kind: "BASE_QUANTITY_TOO_SMALL",
          inventoryItemId: line.inventoryItemId,
        };
      }

      const inventoryValueBefore =
        balance.inventoryValue ??
        (isZeroDecimal(balance.currentStock) ? "0.000000" : null);

      if (inventoryValueBefore === null) {
        await connection.rollback();

        return {
          kind: "UNVALUED_STOCK",
          inventoryItemId: line.inventoryItemId,
        };
      }

      const [calculationRows] = await connection.execute<
        PurchaseCalculationRow[]
      >(
        `
            SELECT
              CAST(
                ROUND(
                  CAST(? AS DECIMAL(24, 6))
                  /
                  CAST(? AS DECIMAL(18, 3)),
                  6
                )
                AS CHAR
              ) AS unitCost,

              CAST(
                ROUND(
                  CAST(? AS DECIMAL(18, 3))
                  +
                  CAST(? AS DECIMAL(18, 3)),
                  3
                )
                AS CHAR
              ) AS balanceAfter,

              CAST(
                ROUND(
                  CAST(? AS DECIMAL(24, 6))
                  +
                  CAST(? AS DECIMAL(24, 6)),
                  6
                )
                AS CHAR
              ) AS inventoryValueAfter,

              CAST(
                ROUND(
                  (
                    CAST(? AS DECIMAL(24, 6))
                    +
                    CAST(? AS DECIMAL(24, 6))
                  )
                  /
                  (
                    CAST(? AS DECIMAL(18, 3))
                    +
                    CAST(? AS DECIMAL(18, 3))
                  ),
                  6
                )
                AS CHAR
              ) AS averageUnitCostAfter
          `,
        [
          line.totalCost,
          baseQuantity,

          balance.currentStock,
          baseQuantity,

          inventoryValueBefore,
          line.totalCost,

          inventoryValueBefore,
          line.totalCost,
          balance.currentStock,
          baseQuantity,
        ],
      );

      const calculation = calculationRows[0];

      if (!calculation) {
        throw new Error("No fue posible calcular el costo de la compra");
      }

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO inventory_movement_lines (
            business_id,
            movement_id,
            inventory_item_id,

            purchase_presentation_id,
            purchase_presentation_name,
            purchased_quantity,
            purchase_conversion_factor,

            direction,
            quantity,

            unit_cost,
            total_cost,

            balance_before,
            balance_after,

            average_unit_cost_before,
            average_unit_cost_after,

            inventory_value_before,
            inventory_value_after,

            cost_status,
            notes
          )
          VALUES (
            ?,
            ?,
            ?,

            ?,
            ?,
            ?,
            ?,

            'IN',
            ?,

            ?,
            ?,

            ?,
            ?,

            ?,
            ?,

            ?,
            ?,

            'VALUED',
            ?
          )
        `,
        [
          businessId,
          movementId,
          line.inventoryItemId,

          line.presentationId,
          presentation.name,
          line.purchasedQuantity,
          presentation.conversionFactor,

          baseQuantity,

          calculation.unitCost,
          line.totalCost,

          balance.currentStock,
          calculation.balanceAfter,

          balance.averageUnitCost,
          calculation.averageUnitCostAfter,

          inventoryValueBefore,
          calculation.inventoryValueAfter,

          line.notes,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE inventory_location_balances

          SET
            current_stock = ?,
            average_unit_cost = ?,
            inventory_value = ?,
            valuation_status = 'VALUED'

          WHERE
            business_id = ?
            AND location_id = ?
            AND inventory_item_id = ?
        `,
        [
          calculation.balanceAfter,
          calculation.averageUnitCostAfter,
          calculation.inventoryValueAfter,
          businessId,
          data.locationId,
          line.inventoryItemId,
        ],
      );

      /*
       * Compatibilidad temporal:
       *
       * inventory_items.current_stock continúa siendo utilizado por
       * órdenes, producción y algunas pantallas antiguas.
       *
       * Cuando todos esos procesos trabajen por ubicación, este UPDATE
       * deberá eliminarse.
       */
      await connection.execute<ResultSetHeader>(
        `
          UPDATE inventory_items

          SET current_stock = current_stock + ?

          WHERE
            business_id = ?
            AND id = ?
        `,
        [baseQuantity, businessId, line.inventoryItemId],
      );

      balance.currentStock = calculation.balanceAfter;
      balance.averageUnitCost = calculation.averageUnitCostAfter;
      balance.inventoryValue = calculation.inventoryValueAfter;
      balance.valuationStatus = "VALUED";
    }

    await connection.commit();

    const purchase = await findInventoryPurchaseById(businessId, movementId);

    if (!purchase) {
      throw new Error("No fue posible recuperar la compra creada");
    }

    return {
      kind: "CREATED",
      purchase,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createInventoryPurchaseRecord, findInventoryPurchaseById };
