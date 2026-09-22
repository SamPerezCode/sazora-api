import { AppError } from "../../../shared/errors/app-error";
import type { Employee } from "../employee.types";
import { updateEmployeeMembershipStatus } from "../repositories/employee.repository";
import type { UpdateEmployeeStatusInput } from "../schemas/update-employee-status.schema";

const updateEmployeeStatus = async (
  businessId: string,
  authenticatedMembershipId: string,
  employeeMembershipId: string,
  input: UpdateEmployeeStatusInput,
): Promise<Employee> => {
  if (authenticatedMembershipId === employeeMembershipId) {
    throw new AppError(
      "No puedes cambiar el estado de tu propia membresía",
      409,
      "EMPLOYEE_SELF_STATUS_CHANGE_NOT_ALLOWED",
    );
  }

  const employee = await updateEmployeeMembershipStatus(
    businessId,
    employeeMembershipId,
    input.isActive,
  );

  if (!employee) {
    throw new AppError(
      "El empleado no existe en este negocio",
      404,
      "EMPLOYEE_NOT_FOUND",
    );
  }

  return employee;
};

export { updateEmployeeStatus };
