import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  PublicOrderAssignment,
  PublicOrderAssignmentScheduleType,
  PublicOrderServiceScope,
  SavePublicOrderAssignmentData,
} from "../public-order-assignment.types";

type PublicOrderAssignmentRow = RowDataPacket & {
  id: string;
  businessId: string;
  assignedMembershipId: string;
  assignedFullName: string;
  assignedEmail: string;
  serviceScope: PublicOrderServiceScope;
  scheduleType: PublicOrderAssignmentScheduleType;
  specificDate: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  priority: number;
  isActive: number;
  createdByMembershipId: string;
  createdByFullName: string;
  createdAt: Date;
  updatedAt: Date;
};

const mapPublicOrderAssignmentRow = (
  row: PublicOrderAssignmentRow,
): PublicOrderAssignment => ({
  id: row.id,
  businessId: row.businessId,
  assignedMembershipId: row.assignedMembershipId,
  assignedFullName: row.assignedFullName,
  assignedEmail: row.assignedEmail,
  serviceScope: row.serviceScope,
  scheduleType: row.scheduleType,
  specificDate: row.specificDate,
  dayOfWeek: row.dayOfWeek,
  startTime: row.startTime,
  endTime: row.endTime,
  priority: row.priority,
  isActive: Boolean(row.isActive),
  createdByMembershipId: row.createdByMembershipId,
  createdByFullName: row.createdByFullName,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const assignmentSelect = `
  SELECT
    CAST(poa.id AS CHAR) AS id,
    CAST(poa.business_id AS CHAR) AS businessId,
    CAST(poa.assigned_membership_id AS CHAR)
      AS assignedMembershipId,
    assigned_user.full_name AS assignedFullName,
    assigned_user.email AS assignedEmail,
    poa.service_scope AS serviceScope,
    CASE
      WHEN poa.specific_date IS NOT NULL
        THEN 'SPECIFIC_DATE'
      WHEN poa.day_of_week IS NOT NULL
        THEN 'WEEKLY'
      ELSE 'PERMANENT'
    END AS scheduleType,
    CAST(poa.specific_date AS CHAR) AS specificDate,
    poa.day_of_week AS dayOfWeek,
    TIME_FORMAT(poa.start_time, '%H:%i') AS startTime,
    TIME_FORMAT(poa.end_time, '%H:%i') AS endTime,
    poa.priority,
    poa.is_active AS isActive,
    CAST(poa.created_by_membership_id AS CHAR)
      AS createdByMembershipId,
    creator_user.full_name AS createdByFullName,
    poa.created_at AS createdAt,
    poa.updated_at AS updatedAt
  FROM public_order_assignments AS poa
  INNER JOIN business_memberships AS assigned_membership
    ON assigned_membership.business_id = poa.business_id
    AND assigned_membership.id = poa.assigned_membership_id
  INNER JOIN users AS assigned_user
    ON assigned_user.id = assigned_membership.user_id
  INNER JOIN business_memberships AS creator_membership
    ON creator_membership.business_id = poa.business_id
    AND creator_membership.id = poa.created_by_membership_id
  INNER JOIN users AS creator_user
    ON creator_user.id = creator_membership.user_id
`;

const findPublicOrderAssignmentById = async (
  businessId: string,
  assignmentId: string,
): Promise<PublicOrderAssignment | null> => {
  const [rows] = await databasePool.execute<PublicOrderAssignmentRow[]>(
    `
      ${assignmentSelect}
      WHERE
        poa.business_id = ?
        AND poa.id = ?
      LIMIT 1
    `,
    [businessId, assignmentId],
  );

  const assignment = rows[0];

  return assignment ? mapPublicOrderAssignmentRow(assignment) : null;
};

const findPublicOrderAssignmentsByBusinessId = async (
  businessId: string,
): Promise<PublicOrderAssignment[]> => {
  const [rows] = await databasePool.execute<PublicOrderAssignmentRow[]>(
    `
      ${assignmentSelect}
      WHERE poa.business_id = ?
      ORDER BY
        poa.is_active DESC,
        poa.service_scope ASC,
        poa.specific_date ASC,
        poa.day_of_week ASC,
        poa.start_time ASC,
        poa.priority DESC,
        poa.id ASC
    `,
    [businessId],
  );

  return rows.map(mapPublicOrderAssignmentRow);
};

const insertPublicOrderAssignment = async (
  businessId: string,
  createdByMembershipId: string,
  data: SavePublicOrderAssignmentData,
): Promise<PublicOrderAssignment> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO public_order_assignments (
        business_id,
        assigned_membership_id,
        service_scope,
        specific_date,
        day_of_week,
        start_time,
        end_time,
        priority,
        created_by_membership_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      businessId,
      data.assignedMembershipId,
      data.serviceScope,
      data.specificDate,
      data.dayOfWeek,
      data.startTime,
      data.endTime,
      data.priority,
      createdByMembershipId,
    ],
  );

  const assignment = await findPublicOrderAssignmentById(
    businessId,
    result.insertId.toString(),
  );

  if (!assignment) {
    throw new Error("No fue posible recuperar la asignación creada");
  }

  return assignment;
};

const updatePublicOrderAssignmentById = async (
  businessId: string,
  assignmentId: string,
  data: SavePublicOrderAssignmentData,
): Promise<PublicOrderAssignment | null> => {
  const currentAssignment = await findPublicOrderAssignmentById(
    businessId,
    assignmentId,
  );

  if (!currentAssignment) {
    return null;
  }

  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE public_order_assignments
      SET
        assigned_membership_id = ?,
        service_scope = ?,
        specific_date = ?,
        day_of_week = ?,
        start_time = ?,
        end_time = ?,
        priority = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [
      data.assignedMembershipId,
      data.serviceScope,
      data.specificDate,
      data.dayOfWeek,
      data.startTime,
      data.endTime,
      data.priority,
      businessId,
      assignmentId,
    ],
  );

  return findPublicOrderAssignmentById(businessId, assignmentId);
};

const updatePublicOrderAssignmentStatusById = async (
  businessId: string,
  assignmentId: string,
  isActive: boolean,
): Promise<PublicOrderAssignment | null> => {
  const currentAssignment = await findPublicOrderAssignmentById(
    businessId,
    assignmentId,
  );

  if (!currentAssignment) {
    return null;
  }

  await databasePool.execute<ResultSetHeader>(
    `
      UPDATE public_order_assignments
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, assignmentId],
  );

  return findPublicOrderAssignmentById(businessId, assignmentId);
};

export {
  findPublicOrderAssignmentById,
  findPublicOrderAssignmentsByBusinessId,
  insertPublicOrderAssignment,
  updatePublicOrderAssignmentById,
  updatePublicOrderAssignmentStatusById,
};
