import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { LocationType } from "../../locations/location.types";
import type {
  EmployeeLocationAssignment,
  EmployeeLocationAssignmentInput,
} from "../employee-location.types";

type AssignmentRow = RowDataPacket & {
  locationId: string;
  code: string;
  name: string;
  locationType: LocationType;
  isDefault: number;
  assignedAt: Date;
};

type MembershipRow = RowDataPacket & {
  id: string;
};

type AdminRoleRow = RowDataPacket & {
  id: string;
};

type AvailableLocationRow = RowDataPacket & {
  id: string;
};

type ReplaceEmployeeLocationsResult =
  | Readonly<{
      kind: "UPDATED";
      assignments: readonly EmployeeLocationAssignment[];
    }>
  | Readonly<{
      kind: "MEMBERSHIP_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ADMIN_HAS_GLOBAL_LOCATION_ACCESS";
    }>
  | Readonly<{
      kind: "LOCATIONS_NOT_AVAILABLE";
      locationIds: readonly string[];
    }>;

const mapAssignmentRow = (row: AssignmentRow): EmployeeLocationAssignment => ({
  locationId: row.locationId,
  code: row.code,
  name: row.name,
  locationType: row.locationType,
  isDefault: Boolean(row.isDefault),
  assignedAt: row.assignedAt,
});

const findEmployeeLocationAssignments = async (
  businessId: string,
  employeeMembershipId: string,
): Promise<EmployeeLocationAssignment[]> => {
  const [rows] = await databasePool.execute<AssignmentRow[]>(
    `
      SELECT
        CAST(bml.location_id AS CHAR) AS locationId,
        bl.code,
        bl.name,
        bl.location_type AS locationType,
        bml.is_default AS isDefault,
        bml.created_at AS assignedAt
      FROM business_membership_locations AS bml
      INNER JOIN business_locations AS bl
        ON bl.business_id = bml.business_id
        AND bl.id = bml.location_id
      WHERE
        bml.business_id = ?
        AND bml.business_membership_id = ?
      ORDER BY
        bml.is_default DESC,
        bl.is_active DESC,
        bl.name ASC,
        bl.id ASC
    `,
    [businessId, employeeMembershipId],
  );

  return rows.map(mapAssignmentRow);
};

const replaceEmployeeLocationAssignments = async (
  businessId: string,
  employeeMembershipId: string,
  assignments: readonly EmployeeLocationAssignmentInput[],
): Promise<ReplaceEmployeeLocationsResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [membershipRows] = await connection.execute<MembershipRow[]>(
      `
          SELECT CAST(id AS CHAR) AS id
          FROM business_memberships
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, employeeMembershipId],
    );

    if (!membershipRows[0]) {
      await connection.rollback();

      return {
        kind: "MEMBERSHIP_NOT_FOUND",
      };
    }

    /*
     * replaceEmployeeRoles bloquea la misma fila de membresía.
     * Esto serializa cambios simultáneos de roles y ubicaciones.
     */
    const [adminRoleRows] = await connection.execute<AdminRoleRow[]>(
      `
          SELECT CAST(bmr.id AS CHAR) AS id
          FROM business_membership_roles AS bmr
          INNER JOIN roles AS r
            ON r.id = bmr.role_id
          WHERE
            bmr.business_membership_id = ?
            AND bmr.is_active = TRUE
            AND r.is_active = TRUE
            AND r.code = 'ADMIN'
          LIMIT 1
        `,
      [employeeMembershipId],
    );

    if (adminRoleRows[0]) {
      await connection.rollback();

      return {
        kind: "ADMIN_HAS_GLOBAL_LOCATION_ACCESS",
      };
    }

    if (assignments.length > 0) {
      const locationIds = assignments
        .map(({ locationId }) => locationId)
        .sort((first, second) => {
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

      const placeholders = locationIds.map(() => "?").join(", ");

      const [availableLocationRows] = await connection.execute<
        AvailableLocationRow[]
      >(
        `
            SELECT CAST(id AS CHAR) AS id
            FROM business_locations
            WHERE
              business_id = ?
              AND id IN (${placeholders})
              AND is_active = TRUE
            ORDER BY id ASC
            FOR SHARE
          `,
        [businessId, ...locationIds],
      );

      const availableLocationIds = new Set(
        availableLocationRows.map(({ id }) => id),
      );

      const unavailableLocationIds = locationIds.filter(
        (locationId) => !availableLocationIds.has(locationId),
      );

      if (unavailableLocationIds.length > 0) {
        await connection.rollback();

        return {
          kind: "LOCATIONS_NOT_AVAILABLE",
          locationIds: unavailableLocationIds,
        };
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM business_membership_locations
        WHERE
          business_id = ?
          AND business_membership_id = ?
      `,
      [businessId, employeeMembershipId],
    );

    for (const assignment of assignments) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO business_membership_locations (
            business_id,
            business_membership_id,
            location_id,
            is_default
          )
          VALUES (?, ?, ?, ?)
        `,
        [
          businessId,
          employeeMembershipId,
          assignment.locationId,
          assignment.isDefault,
        ],
      );
    }

    await connection.commit();

    const updatedAssignments = await findEmployeeLocationAssignments(
      businessId,
      employeeMembershipId,
    );

    return {
      kind: "UPDATED",
      assignments: updatedAssignments,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { findEmployeeLocationAssignments, replaceEmployeeLocationAssignments };

export type { ReplaceEmployeeLocationsResult };
