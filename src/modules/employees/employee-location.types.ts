import type { LocationType } from "../locations/location.types";

type EmployeeLocationAssignmentInput = Readonly<{
  locationId: string;
  isDefault: boolean;
}>;

type EmployeeLocationAssignment = Readonly<{
  locationId: string;
  code: string;
  name: string;
  locationType: LocationType;
  isDefault: boolean;
  assignedAt: Date;
}>;

type EmployeeLocationAccess = Readonly<{
  employeeMembershipId: string;
  hasGlobalLocationAccess: boolean;
  defaultLocationId: string | null;
  assignments: readonly EmployeeLocationAssignment[];
}>;

export type {
  EmployeeLocationAccess,
  EmployeeLocationAssignment,
  EmployeeLocationAssignmentInput,
};
