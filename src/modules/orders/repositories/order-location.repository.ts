import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenWorkflowMode } from "../../kitchen-settings/kitchen-settings.types";

type OrderLocationRow = RowDataPacket & {
  locationId: string;
};

type OrderRealtimeContextRow = RowDataPacket & {
  locationId: string;
  kitchenWorkflowMode: KitchenWorkflowMode | null;
};

type OrderRealtimeContext = Readonly<{
  locationId: string;
  kitchenWorkflowMode: KitchenWorkflowMode | null;
}>;

const findOrderLocationId = async (
  businessId: string,
  orderId: string,
): Promise<string | null> => {
  const [rows] = await databasePool.execute<OrderLocationRow[]>(
    `
        SELECT
          CAST(location_id AS CHAR) AS locationId
        FROM orders
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
      `,
    [businessId, orderId],
  );

  return rows[0]?.locationId ?? null;
};

const findOrderRealtimeContext = async (
  businessId: string,
  orderId: string,
): Promise<OrderRealtimeContext | null> => {
  const [rows] = await databasePool.execute<OrderRealtimeContextRow[]>(
    `
        SELECT
          CAST(location_id AS CHAR) AS locationId,
          kitchen_workflow_mode AS kitchenWorkflowMode
        FROM orders
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
      `,
    [businessId, orderId],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    locationId: row.locationId,
    kitchenWorkflowMode: row.kitchenWorkflowMode,
  };
};

export { findOrderLocationId, findOrderRealtimeContext };

export type { OrderRealtimeContext };
