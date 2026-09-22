import { AppError } from "../../../shared/errors/app-error";
import type { Employee } from "../employee.types";
import { findEmployeeByMembershipId } from "../repositories/employee.repository";
import { replaceEmployeeRoles } from "../repositories/employee-role.repository";
import type { UpdateEmployeeRolesInput } from "../schemas/update-employee-roles.schema";

const updateEmployeeRoles = async (
  businessId: string,
  authenticatedMembershipId: string,
  employeeMembershipId: string,
  input: UpdateEmployeeRolesInput,
): Promise<Employee> => {
  if (authenticatedMembershipId === employeeMembershipId) {
    throw new AppError(
      "No puedes modificar los roles de tu propia membresía",
      409,
      "EMPLOYEE_SELF_ROLE_CHANGE_NOT_ALLOWED",
    );
  }

  const result = await replaceEmployeeRoles(
    businessId,
    employeeMembershipId,
    input.roles,
  );

  switch (result.kind) {
    case "MEMBERSHIP_NOT_FOUND":
      throw new AppError(
        "El empleado no existe en este negocio",
        404,
        "EMPLOYEE_NOT_FOUND",
      );

    case "ADMIN_MEMBERSHIP_NOT_EDITABLE":
      throw new AppError(
        "Los roles de una membresía administrativa no pueden modificarse desde este endpoint",
        409,
        "ADMIN_MEMBERSHIP_ROLES_NOT_EDITABLE",
      );

    case "ROLE_NOT_AVAILABLE":
      throw new AppError(
        "Uno de los roles no está disponible",
        409,
        "EMPLOYEE_ROLE_NOT_AVAILABLE",
      );

    case "UPDATED": {
      const employee = await findEmployeeByMembershipId(
        businessId,
        employeeMembershipId,
      );

      if (!employee) {
        throw new Error(
          "No fue posible recuperar el empleado después de actualizar sus roles",
        );
      }

      return employee;
    }
  }
};

export { updateEmployeeRoles };
