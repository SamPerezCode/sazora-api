import { AppError } from "../../../shared/errors/app-error";
import { hashPassword } from "../../auth/services/password.service";
import type { Employee } from "../employee.types";
import { createEmployee as createEmployeeRecord } from "../repositories/employee.repository";
import type { CreateEmployeeInput } from "../schemas/create-employee.schema";

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const createEmployee = async (
  businessId: string,
  input: CreateEmployeeInput,
): Promise<Employee> => {
  const passwordHash = await hashPassword(input.password);

  try {
    const result = await createEmployeeRecord(businessId, {
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      roles: input.roles,
    });

    switch (result.kind) {
      case "CREATED":
        return result.employee;

      case "ROLE_NOT_AVAILABLE":
        throw new AppError(
          "Uno de los roles no está disponible",
          409,
          "EMPLOYEE_ROLE_NOT_AVAILABLE",
        );
    }
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una cuenta con ese correo. La vinculación de cuentas existentes requerirá una invitación",
        409,
        "EMPLOYEE_EMAIL_CONFLICT",
      );
    }

    throw error;
  }
};

export { createEmployee };
