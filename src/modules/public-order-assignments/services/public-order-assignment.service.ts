import { findEmployeeByMembershipId } from "../../employees/repositories/employee.repository";
import { AppError } from "../../../shared/errors/app-error";
import type {
  PublicOrderAssignment,
  SavePublicOrderAssignmentData,
} from "../public-order-assignment.types";
import {
  findPublicOrderAssignmentsByBusinessId,
  insertPublicOrderAssignment,
  updatePublicOrderAssignmentById,
  updatePublicOrderAssignmentStatusById,
} from "../repositories/public-order-assignment.repository";

const validateAssignee = async (
  businessId: string,
  assignedMembershipId: string,
): Promise<void> => {
  const employee = await findEmployeeByMembershipId(
    businessId,
    assignedMembershipId,
  );

  if (!employee) {
    throw new AppError(
      "La membresía seleccionada no pertenece al negocio",
      404,
      "ASSIGNEE_NOT_FOUND",
    );
  }

  if (!employee.isActive || !employee.membershipIsActive) {
    throw new AppError(
      "La persona seleccionada no está activa",
      409,
      "ASSIGNEE_NOT_ACTIVE",
    );
  }

  if (!employee.roles.includes("PUBLIC_ORDER_MANAGER")) {
    throw new AppError(
      "La persona debe tener el rol de gestor de pedidos públicos",
      409,
      "PUBLIC_ORDER_MANAGER_ROLE_REQUIRED",
    );
  }
};

const createPublicOrderAssignment = async (
  businessId: string,
  createdByMembershipId: string,
  data: SavePublicOrderAssignmentData,
): Promise<PublicOrderAssignment> => {
  await validateAssignee(businessId, data.assignedMembershipId);

  return insertPublicOrderAssignment(businessId, createdByMembershipId, data);
};

const listPublicOrderAssignments = async (
  businessId: string,
): Promise<PublicOrderAssignment[]> =>
  findPublicOrderAssignmentsByBusinessId(businessId);

const updatePublicOrderAssignment = async (
  businessId: string,
  assignmentId: string,
  data: SavePublicOrderAssignmentData,
): Promise<PublicOrderAssignment> => {
  await validateAssignee(businessId, data.assignedMembershipId);

  const assignment = await updatePublicOrderAssignmentById(
    businessId,
    assignmentId,
    data,
  );

  if (!assignment) {
    throw new AppError(
      "La asignación no existe",
      404,
      "PUBLIC_ORDER_ASSIGNMENT_NOT_FOUND",
    );
  }

  return assignment;
};

const changePublicOrderAssignmentStatus = async (
  businessId: string,
  assignmentId: string,
  isActive: boolean,
): Promise<PublicOrderAssignment> => {
  const assignment = await updatePublicOrderAssignmentStatusById(
    businessId,
    assignmentId,
    isActive,
  );

  if (!assignment) {
    throw new AppError(
      "La asignación no existe",
      404,
      "PUBLIC_ORDER_ASSIGNMENT_NOT_FOUND",
    );
  }

  return assignment;
};

export {
  changePublicOrderAssignmentStatus,
  createPublicOrderAssignment,
  listPublicOrderAssignments,
  updatePublicOrderAssignment,
};
