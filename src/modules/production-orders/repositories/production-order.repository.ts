import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";

import type { InventoryUnit } from "../../inventory-items/inventory-item.types";

import type {
  ProductionOrder,
  ProductionOrderInput,
  ProductionOrderListFilters,
  ProductionOrderOutput,
  ProductionOrderStatus,
  ProductionOrderSummary,
  SaveProductionOrderData,
  UpdateProductionOrderResult,
  UpdateProductionOrderStatusResult,
} from "../production-order.types";

type ProductionOrderRow = RowDataPacket & {
  id: string;
  businessId: string;

  recipeId: string;
  recipeCode: string;
  recipeName: string;

  locationId: string;
  locationName: string;
  locationCode: string;

  status: ProductionOrderStatus;
  batchQuantity: string;
  plannedFor: Date | null;
  notes: string | null;

  inventoryMovementId: string | null;
  version: number;

  createdByMembershipId: string;
  createdByName: string;

  updatedByMembershipId: string;
  updatedByName: string;

  startedByMembershipId: string | null;
  startedByName: string | null;

  completedByMembershipId: string | null;
  completedByName: string | null;

  cancelledByMembershipId: string | null;
  cancelledByName: string | null;

  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
};

type ProductionOrderSummaryRow = ProductionOrderRow & {
  inputCount: string;
  outputCount: string;
};

type ProductionOrderInputRow = RowDataPacket & {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string | null;
  baseUnit: InventoryUnit;
  plannedQuantity: string;
  actualQuantity: string | null;
};

type ProductionOrderOutputRow = ProductionOrderInputRow & {
  costAllocationPercentage: string;
};

type LockedProductionOrderRow = RowDataPacket & {
  id: string;
  status: ProductionOrderStatus;
  version: number;
  plannedFor: Date | null;
};

const productionOrderSelect = `
  SELECT
    CAST(po.id AS CHAR) AS id,
    CAST(po.business_id AS CHAR) AS businessId,

    CAST(po.recipe_id AS CHAR) AS recipeId,
    po.recipe_code_snapshot AS recipeCode,
    po.recipe_name_snapshot AS recipeName,

    CAST(po.location_id AS CHAR) AS locationId,
    bl.name AS locationName,
    bl.code AS locationCode,

    po.status,
    CAST(po.batch_quantity AS CHAR) AS batchQuantity,
    po.planned_for AS plannedFor,
    po.notes,

    CAST(po.inventory_movement_id AS CHAR)
      AS inventoryMovementId,

    po.version,

    CAST(po.created_by_membership_id AS CHAR)
      AS createdByMembershipId,

    created_user.full_name AS createdByName,

    CAST(po.updated_by_membership_id AS CHAR)
      AS updatedByMembershipId,

    updated_user.full_name AS updatedByName,

    CAST(po.started_by_membership_id AS CHAR)
      AS startedByMembershipId,

    started_user.full_name AS startedByName,

    CAST(po.completed_by_membership_id AS CHAR)
      AS completedByMembershipId,

    completed_user.full_name AS completedByName,

    CAST(po.cancelled_by_membership_id AS CHAR)
      AS cancelledByMembershipId,

    cancelled_user.full_name AS cancelledByName,

    po.created_at AS createdAt,
    po.updated_at AS updatedAt,
    po.started_at AS startedAt,
    po.completed_at AS completedAt,
    po.cancelled_at AS cancelledAt,
    po.cancellation_reason AS cancellationReason

  FROM production_orders AS po

  INNER JOIN business_locations AS bl
    ON bl.business_id = po.business_id
    AND bl.id = po.location_id

  INNER JOIN business_memberships AS created_membership
    ON created_membership.business_id = po.business_id
    AND created_membership.id =
      po.created_by_membership_id

  INNER JOIN users AS created_user
    ON created_user.id = created_membership.user_id

  INNER JOIN business_memberships AS updated_membership
    ON updated_membership.business_id = po.business_id
    AND updated_membership.id =
      po.updated_by_membership_id

  INNER JOIN users AS updated_user
    ON updated_user.id = updated_membership.user_id

  LEFT JOIN business_memberships AS started_membership
    ON started_membership.business_id = po.business_id
    AND started_membership.id =
      po.started_by_membership_id

  LEFT JOIN users AS started_user
    ON started_user.id = started_membership.user_id

  LEFT JOIN business_memberships AS completed_membership
    ON completed_membership.business_id = po.business_id
    AND completed_membership.id =
      po.completed_by_membership_id

  LEFT JOIN users AS completed_user
    ON completed_user.id = completed_membership.user_id

  LEFT JOIN business_memberships AS cancelled_membership
    ON cancelled_membership.business_id = po.business_id
    AND cancelled_membership.id =
      po.cancelled_by_membership_id

  LEFT JOIN users AS cancelled_user
    ON cancelled_user.id = cancelled_membership.user_id
`;

const mapProductionOrder = (
  row: ProductionOrderRow,
  inputs: readonly ProductionOrderInput[],
  outputs: readonly ProductionOrderOutput[],
): ProductionOrder => ({
  id: row.id,
  businessId: row.businessId,

  recipe: {
    id: row.recipeId,
    code: row.recipeCode,
    name: row.recipeName,
  },

  location: {
    id: row.locationId,
    name: row.locationName,
    code: row.locationCode,
  },

  status: row.status,
  batchQuantity: row.batchQuantity,
  plannedFor: row.plannedFor,
  notes: row.notes,

  inventoryMovementId: row.inventoryMovementId,
  version: row.version,

  createdByMembershipId: row.createdByMembershipId,
  createdByName: row.createdByName,

  updatedByMembershipId: row.updatedByMembershipId,
  updatedByName: row.updatedByName,

  startedByMembershipId: row.startedByMembershipId,
  startedByName: row.startedByName,

  completedByMembershipId: row.completedByMembershipId,
  completedByName: row.completedByName,

  cancelledByMembershipId: row.cancelledByMembershipId,
  cancelledByName: row.cancelledByName,

  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
  cancelledAt: row.cancelledAt,
  cancellationReason: row.cancellationReason,

  inputs,
  outputs,
});

const findProductionOrderById = async (
  businessId: string,
  productionOrderId: string,
): Promise<ProductionOrder | null> => {
  const [orderRows] = await databasePool.execute<ProductionOrderRow[]>(
    `
      ${productionOrderSelect}

      WHERE
        po.business_id = ?
        AND po.id = ?

      LIMIT 1
    `,
    [businessId, productionOrderId],
  );

  const order = orderRows[0];

  if (!order) {
    return null;
  }

  const [inputResult, outputResult] = await Promise.all([
    databasePool.execute<ProductionOrderInputRow[]>(
      `
        SELECT
          CAST(poi.id AS CHAR) AS id,

          CAST(poi.inventory_item_id AS CHAR)
            AS inventoryItemId,

          poi.inventory_item_name_snapshot
            AS inventoryItemName,

          poi.inventory_item_sku_snapshot
            AS inventoryItemSku,

          poi.base_unit_snapshot AS baseUnit,

          CAST(poi.planned_quantity AS CHAR)
            AS plannedQuantity,

          CAST(poi.actual_quantity AS CHAR)
            AS actualQuantity

        FROM production_order_inputs AS poi

        WHERE
          poi.business_id = ?
          AND poi.production_order_id = ?

        ORDER BY poi.id ASC
      `,
      [businessId, productionOrderId],
    ),

    databasePool.execute<ProductionOrderOutputRow[]>(
      `
        SELECT
          CAST(poo.id AS CHAR) AS id,

          CAST(poo.inventory_item_id AS CHAR)
            AS inventoryItemId,

          poo.inventory_item_name_snapshot
            AS inventoryItemName,

          poo.inventory_item_sku_snapshot
            AS inventoryItemSku,

          poo.base_unit_snapshot AS baseUnit,

          CAST(poo.planned_quantity AS CHAR)
            AS plannedQuantity,

          CAST(poo.actual_quantity AS CHAR)
            AS actualQuantity,

          CAST(
            poo.cost_allocation_percentage AS CHAR
          ) AS costAllocationPercentage

        FROM production_order_outputs AS poo

        WHERE
          poo.business_id = ?
          AND poo.production_order_id = ?

        ORDER BY poo.id ASC
      `,
      [businessId, productionOrderId],
    ),
  ]);

  const inputs: ProductionOrderInput[] = inputResult[0].map((row) => ({
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    inventoryItemName: row.inventoryItemName,
    inventoryItemSku: row.inventoryItemSku,
    baseUnit: row.baseUnit,
    plannedQuantity: row.plannedQuantity,
    actualQuantity: row.actualQuantity,
  }));

  const outputs: ProductionOrderOutput[] = outputResult[0].map((row) => ({
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    inventoryItemName: row.inventoryItemName,
    inventoryItemSku: row.inventoryItemSku,
    baseUnit: row.baseUnit,
    plannedQuantity: row.plannedQuantity,
    actualQuantity: row.actualQuantity,
    costAllocationPercentage: row.costAllocationPercentage,
  }));

  return mapProductionOrder(order, inputs, outputs);
};

const findProductionOrders = async (
  businessId: string,
  filters: ProductionOrderListFilters,
): Promise<ProductionOrderSummary[]> => {
  if (filters.locationIds !== null && filters.locationIds.length === 0) {
    return [];
  }

  const conditions = ["po.business_id = ?"];
  const values: string[] = [businessId];

  if (filters.locationIds !== null) {
    const placeholders = filters.locationIds.map(() => "?").join(", ");

    conditions.push(`po.location_id IN (${placeholders})`);

    values.push(...filters.locationIds);
  }

  if (filters.status !== null) {
    conditions.push("po.status = ?");
    values.push(filters.status);
  }

  const [rows] = await databasePool.execute<ProductionOrderSummaryRow[]>(
    `
      SELECT
        order_data.*,

        (
          SELECT COUNT(*)
          FROM production_order_inputs AS poi
          WHERE
            poi.business_id = order_data.businessId
            AND poi.production_order_id = order_data.id
        ) AS inputCount,

        (
          SELECT COUNT(*)
          FROM production_order_outputs AS poo
          WHERE
            poo.business_id = order_data.businessId
            AND poo.production_order_id = order_data.id
        ) AS outputCount

      FROM (
        ${productionOrderSelect}

        WHERE ${conditions.join("\n AND ")}
      ) AS order_data

      ORDER BY
        CASE order_data.status
          WHEN 'IN_PROGRESS' THEN 1
          WHEN 'PLANNED' THEN 2
          WHEN 'DRAFT' THEN 3
          WHEN 'COMPLETED' THEN 4
          WHEN 'CANCELLED' THEN 5
          ELSE 6
        END,
        order_data.plannedFor IS NULL ASC,
        order_data.plannedFor ASC,
        order_data.id DESC
    `,
    values,
  );

  return rows.map((row) => {
    const {
      inputs: _inputs,
      outputs: _outputs,
      ...order
    } = mapProductionOrder(row, [], []);

    return {
      ...order,
      inputCount: Number(row.inputCount),
      outputCount: Number(row.outputCount),
    };
  });
};

const insertProductionOrderLines = async (
  connection: PoolConnection,
  businessId: string,
  productionOrderId: string,
  data: SaveProductionOrderData,
): Promise<void> => {
  for (const input of data.inputs) {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO production_order_inputs (
          business_id,
          production_order_id,
          inventory_item_id,
          inventory_item_name_snapshot,
          inventory_item_sku_snapshot,
          base_unit_snapshot,
          planned_quantity,
          actual_quantity
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `,
      [
        businessId,
        productionOrderId,
        input.inventoryItemId,
        input.inventoryItemName,
        input.inventoryItemSku,
        input.baseUnit,
        input.plannedQuantity,
      ],
    );
  }

  for (const output of data.outputs) {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO production_order_outputs (
          business_id,
          production_order_id,
          inventory_item_id,
          inventory_item_name_snapshot,
          inventory_item_sku_snapshot,
          base_unit_snapshot,
          planned_quantity,
          actual_quantity,
          cost_allocation_percentage
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
      `,
      [
        businessId,
        productionOrderId,
        output.inventoryItemId,
        output.inventoryItemName,
        output.inventoryItemSku,
        output.baseUnit,
        output.plannedQuantity,
        output.costAllocationPercentage,
      ],
    );
  }
};

const insertProductionOrder = async (
  businessId: string,
  membershipId: string,
  data: SaveProductionOrderData,
): Promise<ProductionOrder> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO production_orders (
            business_id,
            recipe_id,
            location_id,
            status,
            batch_quantity,
            recipe_code_snapshot,
            recipe_name_snapshot,
            planned_for,
            notes,
            version,
            created_by_membership_id,
            updated_by_membership_id
          )
          VALUES (
            ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, 1, ?, ?
          )
        `,
      [
        businessId,
        data.recipeId,
        data.locationId,
        data.batchQuantity,
        data.recipeCodeSnapshot,
        data.recipeNameSnapshot,
        data.plannedFor,
        data.notes,
        membershipId,
        membershipId,
      ],
    );

    const productionOrderId = result.insertId.toString();

    await insertProductionOrderLines(
      connection,
      businessId,
      productionOrderId,
      data,
    );

    await connection.commit();

    const order = await findProductionOrderById(businessId, productionOrderId);

    if (!order) {
      throw new Error("No fue posible recuperar la orden creada");
    }

    return order;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateProductionOrderById = async (
  businessId: string,
  membershipId: string,
  productionOrderId: string,
  expectedVersion: number,
  data: SaveProductionOrderData,
): Promise<UpdateProductionOrderResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<LockedProductionOrderRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            status,
            version,
            planned_for AS plannedFor

          FROM production_orders

          WHERE
            business_id = ?
            AND id = ?

          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productionOrderId],
    );

    const current = rows[0];

    if (!current) {
      await connection.rollback();
      return { kind: "NOT_FOUND" };
    }

    if (current.status !== "DRAFT") {
      await connection.rollback();
      return { kind: "NOT_DRAFT" };
    }

    if (current.version !== expectedVersion) {
      await connection.rollback();
      return { kind: "VERSION_CONFLICT" };
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE production_orders
        SET
          recipe_id = ?,
          location_id = ?,
          batch_quantity = ?,
          recipe_code_snapshot = ?,
          recipe_name_snapshot = ?,
          planned_for = ?,
          notes = ?,
          updated_by_membership_id = ?,
          version = version + 1

        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        data.recipeId,
        data.locationId,
        data.batchQuantity,
        data.recipeCodeSnapshot,
        data.recipeNameSnapshot,
        data.plannedFor,
        data.notes,
        membershipId,
        businessId,
        productionOrderId,
      ],
    );

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM production_order_outputs
        WHERE
          business_id = ?
          AND production_order_id = ?
      `,
      [businessId, productionOrderId],
    );

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM production_order_inputs
        WHERE
          business_id = ?
          AND production_order_id = ?
      `,
      [businessId, productionOrderId],
    );

    await insertProductionOrderLines(
      connection,
      businessId,
      productionOrderId,
      data,
    );

    await connection.commit();

    const productionOrder = await findProductionOrderById(
      businessId,
      productionOrderId,
    );

    if (!productionOrder) {
      throw new Error("No fue posible recuperar la orden actualizada");
    }

    return {
      kind: "UPDATED",
      productionOrder,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateProductionOrderStatusById = async (
  businessId: string,
  membershipId: string,
  productionOrderId: string,
  expectedVersion: number,
  status: "PLANNED" | "CANCELLED",
  cancellationReason: string | null,
): Promise<UpdateProductionOrderStatusResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<LockedProductionOrderRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            status,
            version,
            planned_for AS plannedFor

          FROM production_orders

          WHERE
            business_id = ?
            AND id = ?

          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productionOrderId],
    );

    const current = rows[0];

    if (!current) {
      await connection.rollback();
      return { kind: "NOT_FOUND" };
    }

    if (current.version !== expectedVersion) {
      await connection.rollback();
      return { kind: "VERSION_CONFLICT" };
    }

    const canPlan =
      status === "PLANNED" &&
      current.status === "DRAFT" &&
      current.plannedFor !== null;

    const canCancel =
      status === "CANCELLED" &&
      (current.status === "DRAFT" || current.status === "PLANNED");

    if (!canPlan && !canCancel) {
      await connection.rollback();
      return { kind: "INVALID_TRANSITION" };
    }

    if (status === "PLANNED") {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE production_orders
          SET
            status = 'PLANNED',
            updated_by_membership_id = ?,
            cancellation_reason = NULL,
            cancelled_by_membership_id = NULL,
            cancelled_at = NULL,
            version = version + 1

          WHERE
            business_id = ?
            AND id = ?
        `,
        [membershipId, businessId, productionOrderId],
      );
    } else {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE production_orders
          SET
            status = 'CANCELLED',
            cancellation_reason = ?,
            cancelled_by_membership_id = ?,
            cancelled_at = CURRENT_TIMESTAMP,
            updated_by_membership_id = ?,
            version = version + 1

          WHERE
            business_id = ?
            AND id = ?
        `,
        [
          cancellationReason,
          membershipId,
          membershipId,
          businessId,
          productionOrderId,
        ],
      );
    }

    await connection.commit();

    const productionOrder = await findProductionOrderById(
      businessId,
      productionOrderId,
    );

    if (!productionOrder) {
      throw new Error("No fue posible recuperar la orden actualizada");
    }

    return {
      kind: "UPDATED",
      productionOrder,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const startProductionOrderById = async (
  businessId: string,
  membershipId: string,
  productionOrderId: string,
  expectedVersion: number,
): Promise<UpdateProductionOrderStatusResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<LockedProductionOrderRow[]>(
      `
          SELECT
            CAST(id AS CHAR) AS id,
            status,
            version,
            planned_for AS plannedFor

          FROM production_orders

          WHERE
            business_id = ?
            AND id = ?

          LIMIT 1
          FOR UPDATE
        `,
      [businessId, productionOrderId],
    );

    const current = rows[0];

    if (!current) {
      await connection.rollback();

      return {
        kind: "NOT_FOUND",
      };
    }

    if (current.version !== expectedVersion) {
      await connection.rollback();

      return {
        kind: "VERSION_CONFLICT",
      };
    }

    if (current.status !== "PLANNED") {
      await connection.rollback();

      return {
        kind: "INVALID_TRANSITION",
      };
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE production_orders
        SET
          status = 'IN_PROGRESS',
          started_by_membership_id = ?,
          started_at = CURRENT_TIMESTAMP,
          updated_by_membership_id = ?,
          version = version + 1

        WHERE
          business_id = ?
          AND id = ?
      `,
      [membershipId, membershipId, businessId, productionOrderId],
    );

    await connection.commit();

    const productionOrder = await findProductionOrderById(
      businessId,
      productionOrderId,
    );

    if (!productionOrder) {
      throw new Error("No fue posible recuperar la orden iniciada");
    }

    return {
      kind: "UPDATED",
      productionOrder,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  findProductionOrderById,
  findProductionOrders,
  insertProductionOrder,
  startProductionOrderById,
  updateProductionOrderById,
  updateProductionOrderStatusById,
};
