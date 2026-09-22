import { AppError } from "../../../shared/errors/app-error";
import type { Employee } from "../employee.types";
import { findEmployeeByMembershipId } from "../repositories/employee.repository";

const getEmployee = async (
  businessId: string,
  employeeMembershipId: string,
): Promise<Employee> => {
  const employee = await findEmployeeByMembershipId(
    businessId,
    employeeMembershipId,
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

export { getEmployee };
