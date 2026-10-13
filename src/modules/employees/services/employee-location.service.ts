import { AppError } from "../../../shared/errors/app-error";
import type { EmployeeLocationAccess } from "../employee-location.types";
import { findEmployeeByMembershipId } from "../repositories/employee.repository";
import {
  findEmployeeLocationAssignments,
  replaceEmployeeLocationAssignments,
} from "../repositories/employee-location.repository";
import type { UpdateEmployeeLocationsInput } from "../schemas/employee-location.schema";

const getEmployeeLocationAccess = async (
  businessId: string,
  employeeMembershipId: string,
): Promise<EmployeeLocationAccess> => {
  const employee = await findEmployeeByMembershipId(
    businessId,
    employeeMembershipId,
  );

  if (!employee) {
    throw new AppError(
      "El empleado no existe en esta organización",
      404,
      "EMPLOYEE_NOT_FOUND",
    );
  }

  const hasGlobalLocationAccess = employee.roles.includes("ADMIN");

  if (hasGlobalLocationAccess) {
    return {
      employeeMembershipId,
      hasGlobalLocationAccess: true,
      defaultLocationId: null,
      assignments: [],
    };
  }

  const assignments = await findEmployeeLocationAssignments(
    businessId,
    employeeMembershipId,
  );

  const defaultAssignment = assignments.find(({ isDefault }) => isDefault);

  return {
    employeeMembershipId,
    hasGlobalLocationAccess: false,
    defaultLocationId: defaultAssignment?.locationId ?? null,
    assignments,
  };
};

const updateEmployeeLocationAccess = async (
  businessId: string,
  employeeMembershipId: string,
  input: UpdateEmployeeLocationsInput,
): Promise<EmployeeLocationAccess> => {
  const result = await replaceEmployeeLocationAssignments(
    businessId,
    employeeMembershipId,
    input.assignments,
  );

  switch (result.kind) {
    case "MEMBERSHIP_NOT_FOUND":
      throw new AppError(
        "El empleado no existe en esta organización",
        404,
        "EMPLOYEE_NOT_FOUND",
      );

    case "ADMIN_HAS_GLOBAL_LOCATION_ACCESS":
      throw new AppError(
        "Los administradores tienen acceso global y no requieren ubicaciones asignadas",
        409,
        "ADMIN_LOCATION_ASSIGNMENT_NOT_ALLOWED",
      );

    case "LOCATIONS_NOT_AVAILABLE":
      throw new AppError(
        `Las siguientes ubicaciones no existen o están inactivas: ${result.locationIds.join(", ")}`,
        409,
        "EMPLOYEE_LOCATIONS_NOT_AVAILABLE",
      );

    case "UPDATED": {
      const defaultAssignment = result.assignments.find(
        ({ isDefault }) => isDefault,
      );

      return {
        employeeMembershipId,
        hasGlobalLocationAccess: false,
        defaultLocationId: defaultAssignment?.locationId ?? null,
        assignments: result.assignments,
      };
    }
  }
};

export { getEmployeeLocationAccess, updateEmployeeLocationAccess };
