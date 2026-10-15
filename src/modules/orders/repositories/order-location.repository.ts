import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

type OrderLocationRow = RowDataPacket & {
  locationId: string;
};

const findOrderLocationId = async (
  businessId: string,
  orderId: string,
): Promise<string | null> => {
  const [rows] = await databasePool.execute<OrderLocationRow[]>(
    `
      SELECT CAST(location_id AS CHAR) AS locationId
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

export { findOrderLocationId };
