import { AppError } from "../../../shared/errors/app-error";
import type { Employee } from "../employee.types";
import { findEmployeeByMembershipId } from "../repositories/employee.repository";
import { updateEmployeeRecord } from "../repositories/update-employee.repository";
import type { UpdateEmployeeInput } from "../schemas/update-employee.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const updateEmployee = async (
  businessId: string,
  employeeMembershipId: string,
  input: UpdateEmployeeInput,
): Promise<Employee> => {
  try {
    const result = await updateEmployeeRecord(
      businessId,
      employeeMembershipId,
      {
        fullName: input.fullName,
        email: input.email,
      },
    );

    switch (result.kind) {
      case "EMPLOYEE_NOT_FOUND":
        throw new AppError(
          "El empleado no existe en este negocio",
          404,
          "EMPLOYEE_NOT_FOUND",
        );

      case "ADMIN_IDENTITY_NOT_EDITABLE":
        throw new AppError(
          "Los datos de una cuenta administrativa no pueden modificarse desde este endpoint",
          409,
          "ADMIN_IDENTITY_NOT_EDITABLE",
        );

      case "SHARED_IDENTITY_NOT_EDITABLE":
        throw new AppError(
          "Esta identidad pertenece a varios negocios y debe modificar sus datos desde su cuenta personal",
          409,
          "SHARED_IDENTITY_NOT_EDITABLE",
        );

      case "UPDATED": {
        const employee = await findEmployeeByMembershipId(
          businessId,
          employeeMembershipId,
        );

        if (!employee) {
          throw new Error(
            "No fue posible recuperar el empleado después de actualizarlo",
          );
        }

        return employee;
      }
    }
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una cuenta con ese correo electrónico",
        409,
        "EMPLOYEE_EMAIL_CONFLICT",
      );
    }

    throw error;
  }
};

export { updateEmployee };
