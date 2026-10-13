import type { EmployeeListItem } from "../employee.types";
import { findEmployeeListLocationAccessByBusinessId } from "../repositories/employee-list-location.repository";
import { findEmployeesByBusinessId } from "../repositories/employee.repository";

const listEmployees = async (
  businessId: string,
): Promise<EmployeeListItem[]> => {
  /*
   * Ambas consultas son masivas e independientes:
   * - empleados y roles;
   * - asignaciones activas de ubicaciones.
   *
   * No se ejecuta una consulta por empleado.
   */
  const [employees, locationAccessByMembershipId] = await Promise.all([
    findEmployeesByBusinessId(businessId),
    findEmployeeListLocationAccessByBusinessId(businessId),
  ]);

  return employees.map((employee) => {
    if (employee.roles.includes("ADMIN")) {
      return {
        ...employee,
        locationAccess: {
          hasGlobalAccess: true,
          defaultLocationId: null,
          locations: [],
        },
      };
    }

    return {
      ...employee,
      locationAccess: locationAccessByMembershipId.get(
        employee.membershipId,
      ) ?? {
        hasGlobalAccess: false,
        defaultLocationId: null,
        locations: [],
      },
    };
  });
};

export { listEmployees };
