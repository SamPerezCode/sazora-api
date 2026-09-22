import type { Employee } from "../employee.types";
import { findEmployeesByBusinessId } from "../repositories/employee.repository";

const listEmployees = async (businessId: string): Promise<Employee[]> =>
  findEmployeesByBusinessId(businessId);

export { listEmployees };
