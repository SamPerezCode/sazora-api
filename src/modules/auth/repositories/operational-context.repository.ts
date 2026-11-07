import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OperationalContext } from "../operational-context.types";

type OperationalContextRow = RowDataPacket & {
  businessId: string;
  currencyCode: string;
  timezone: string;
};

const findOperationalContextByBusinessId = async (
  businessId: string,
): Promise<OperationalContext | null> => {
  const [rows] = await databasePool.execute<OperationalContextRow[]>(
    `
      SELECT
        CAST(b.id AS CHAR) AS businessId,
        b.currency_code AS currencyCode,
        b.timezone
      FROM businesses AS b
      WHERE
        b.id = ?
        AND b.is_active = TRUE
      LIMIT 1
    `,
    [businessId],
  );

  const context = rows[0];

  if (!context) {
    return null;
  }

  return {
    businessId: context.businessId,
    currencyCode: context.currencyCode,
    timezone: context.timezone,
  };
};

export { findOperationalContextByBusinessId };
