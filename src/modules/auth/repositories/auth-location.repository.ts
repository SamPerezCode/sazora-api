import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { LocationType } from "../../locations/location.types";
import type { SessionLocation, SessionLocationAccess } from "../auth.types";

type SessionLocationRow = RowDataPacket & {
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  isDefault: number;
};

const mapSessionLocation = (row: SessionLocationRow): SessionLocation => ({
  id: row.id,
  code: row.code,
  name: row.name,
  locationType: row.locationType,
  isDefault: Boolean(row.isDefault),
});

const findSessionLocationAccess = async (
  businessId: string,
  membershipId: string,
  roles: readonly string[],
): Promise<SessionLocationAccess> => {
  /*
   * Los administradores tienen acceso global y no necesitan
   * asignaciones individuales.
   */
  if (roles.includes("ADMIN")) {
    return {
      hasGlobalAccess: true,
      defaultLocationId: null,
      locations: [],
    };
  }

  const [rows] = await databasePool.execute<SessionLocationRow[]>(
    `
      SELECT
        CAST(bl.id AS CHAR) AS id,
        bl.code,
        bl.name,
        bl.location_type AS locationType,
        bml.is_default AS isDefault
      FROM business_membership_locations AS bml
      INNER JOIN business_locations AS bl
        ON bl.business_id = bml.business_id
        AND bl.id = bml.location_id
        AND bl.is_active = TRUE
      WHERE
        bml.business_id = ?
        AND bml.business_membership_id = ?
      ORDER BY
        bml.is_default DESC,
        bl.name ASC,
        bl.id ASC
    `,
    [businessId, membershipId],
  );

  const locations = rows.map(mapSessionLocation);

  const defaultLocation =
    locations.find((location) => location.isDefault) ?? null;

  return {
    hasGlobalAccess: false,
    defaultLocationId: defaultLocation?.id ?? null,
    locations,
  };
};

export { findSessionLocationAccess };
