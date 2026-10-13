import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  SessionLocation,
  SessionLocationAccess,
} from "../../auth/auth.types";
import type { LocationType } from "../../locations/location.types";

type EmployeeListLocationRow = RowDataPacket & {
  membershipId: string;
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  isDefault: number;
};

const mapLocation = (row: EmployeeListLocationRow): SessionLocation => ({
  id: row.id,
  code: row.code,
  name: row.name,
  locationType: row.locationType,
  isDefault: Boolean(row.isDefault),
});

const findEmployeeListLocationAccessByBusinessId = async (
  businessId: string,
): Promise<ReadonlyMap<string, SessionLocationAccess>> => {
  /*
   * Esta es una única consulta para todos los empleados del negocio.
   * Evita ejecutar una consulta adicional por cada fila del listado.
   */
  const [rows] = await databasePool.execute<EmployeeListLocationRow[]>(
    `
      SELECT
        CAST(bml.business_membership_id AS CHAR) AS membershipId,
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
      WHERE bml.business_id = ?
      ORDER BY
        bml.business_membership_id ASC,
        bml.is_default DESC,
        bl.name ASC,
        bl.id ASC
    `,
    [businessId],
  );

  const locationsByMembershipId = new Map<string, SessionLocation[]>();

  for (const row of rows) {
    const locations = locationsByMembershipId.get(row.membershipId) ?? [];

    locations.push(mapLocation(row));
    locationsByMembershipId.set(row.membershipId, locations);
  }

  const accessByMembershipId = new Map<string, SessionLocationAccess>();

  for (const [membershipId, locations] of locationsByMembershipId) {
    const defaultLocation =
      locations.find((location) => location.isDefault) ?? null;

    accessByMembershipId.set(membershipId, {
      hasGlobalAccess: false,
      defaultLocationId: defaultLocation?.id ?? null,
      locations,
    });
  }

  return accessByMembershipId;
};

export { findEmployeeListLocationAccessByBusinessId };
