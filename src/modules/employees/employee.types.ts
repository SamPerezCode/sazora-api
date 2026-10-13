import type { SessionLocationAccess } from "../auth/auth.types";

type BusinessRoleCode =
  | "ADMIN"
  | "WAITER"
  | "KITCHEN"
  | "PUBLIC_ORDER_MANAGER"
  | "DELIVERY_DRIVER"
  | "PRODUCTION";

type AssignableEmployeeRoleCode =
  | "WAITER"
  | "KITCHEN"
  | "PUBLIC_ORDER_MANAGER"
  | "DELIVERY_DRIVER"
  | "PRODUCTION";

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

type EmployeeListItem = Readonly<
  Employee & {
    locationAccess: SessionLocationAccess;
  }
>;

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
  EmployeeListItem,
};
