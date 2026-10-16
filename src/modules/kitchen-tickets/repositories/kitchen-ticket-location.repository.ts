import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

type KitchenTicketLocationRow = RowDataPacket & {
  locationId: string;
};

const findKitchenTicketLocationId = async (
  businessId: string,
  kitchenTicketId: string,
): Promise<string | null> => {
  const [rows] = await databasePool.execute<KitchenTicketLocationRow[]>(
    `
        SELECT
          CAST(o.location_id AS CHAR) AS locationId
        FROM kitchen_tickets AS kt
        INNER JOIN orders AS o
          ON o.business_id = kt.business_id
          AND o.id = kt.order_id
        WHERE
          kt.business_id = ?
          AND kt.id = ?
        LIMIT 1
      `,
    [businessId, kitchenTicketId],
  );

  return rows[0]?.locationId ?? null;
};

export { findKitchenTicketLocationId };
