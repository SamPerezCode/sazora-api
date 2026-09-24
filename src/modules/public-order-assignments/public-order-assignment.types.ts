type PublicOrderServiceScope = "ALL" | "DELIVERY" | "TAKEAWAY";

type PublicOrderAssignmentScheduleType =
  "PERMANENT" | "WEEKLY" | "SPECIFIC_DATE";

type PublicOrderAssignment = Readonly<{
  id: string;
  businessId: string;
  assignedMembershipId: string;
  assignedFullName: string;
  assignedEmail: string;
  serviceScope: PublicOrderServiceScope;
  scheduleType: PublicOrderAssignmentScheduleType;
  specificDate: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  priority: number;
  isActive: boolean;
  createdByMembershipId: string;
  createdByFullName: string;
  createdAt: Date;
  updatedAt: Date;
}>;

type SavePublicOrderAssignmentData = Readonly<{
  assignedMembershipId: string;
  serviceScope: PublicOrderServiceScope;
  scheduleType: PublicOrderAssignmentScheduleType;
  specificDate: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  priority: number;
}>;

export type {
  PublicOrderAssignment,
  PublicOrderAssignmentScheduleType,
  PublicOrderServiceScope,
  SavePublicOrderAssignmentData,
};
