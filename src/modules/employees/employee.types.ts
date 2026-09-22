type BusinessRoleCode = "ADMIN" | "WAITER" | "KITCHEN";

type AssignableEmployeeRoleCode = "WAITER" | "KITCHEN";

type Employee = Readonly<{
  userId: string;
  membershipId: string;
  businessId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  membershipIsActive: boolean;
  roles: readonly BusinessRoleCode[];
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type CreateEmployeeData = Readonly<{
  fullName: string;
  email: string;
  passwordHash: string;
  roles: readonly AssignableEmployeeRoleCode[];
}>;

export type {
  AssignableEmployeeRoleCode,
  BusinessRoleCode,
  CreateEmployeeData,
  Employee,
};
