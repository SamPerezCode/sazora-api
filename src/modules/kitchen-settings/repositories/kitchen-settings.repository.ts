import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  KitchenWorkflowMode,
  LocationKitchenSettings,
} from "../kitchen-settings.types";

type KitchenSettingsRow = RowDataPacket & {
  businessId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: "PRODUCTION_WAREHOUSE" | "POINT_OF_SALE";
  locationIsActive: number;
  workflowMode: KitchenWorkflowMode;
  isConfigured: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const mapKitchenSettingsRow = (
  row: KitchenSettingsRow,
): LocationKitchenSettings => ({
  businessId: row.businessId,
  locationId: row.locationId,
  workflowMode: row.workflowMode,
  isConfigured: Boolean(row.isConfigured),
  location: {
    id: row.locationId,
    code: row.locationCode,
    name: row.locationName,
    locationType: row.locationType,
    isActive: Boolean(row.locationIsActive),
  },
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findLocationKitchenSettings = async (
  businessId: string,
  locationId: string,
): Promise<LocationKitchenSettings | null> => {
  const [rows] = await databasePool.execute<KitchenSettingsRow[]>(
    `
      SELECT
        CAST(bl.business_id AS CHAR) AS businessId,
        CAST(bl.id AS CHAR) AS locationId,
        bl.code AS locationCode,
        bl.name AS locationName,
        bl.location_type AS locationType,
        bl.is_active AS locationIsActive,
        COALESCE(
          lks.workflow_mode,
          'PRINT_AND_SCREEN'
        ) AS workflowMode,
        (lks.location_id IS NOT NULL) AS isConfigured,
        lks.created_at AS createdAt,
        lks.updated_at AS updatedAt
      FROM business_locations AS bl
      LEFT JOIN location_kitchen_settings AS lks
        ON lks.business_id = bl.business_id
        AND lks.location_id = bl.id
      WHERE
        bl.business_id = ?
        AND bl.id = ?
      LIMIT 1
    `,
    [businessId, locationId],
  );

  const settings = rows[0];

  return settings ? mapKitchenSettingsRow(settings) : null;
};

const upsertLocationKitchenSettings = async (
  businessId: string,
  locationId: string,
  workflowMode: KitchenWorkflowMode,
): Promise<LocationKitchenSettings | null> => {
  const current = await findLocationKitchenSettings(businessId, locationId);

  if (!current) {
    return null;
  }

  await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO location_kitchen_settings (
        business_id,
        location_id,
        workflow_mode
      )
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        workflow_mode = VALUES(workflow_mode)
    `,
    [businessId, locationId, workflowMode],
  );

  return findLocationKitchenSettings(businessId, locationId);
};

export { findLocationKitchenSettings, upsertLocationKitchenSettings };
