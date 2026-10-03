import {
  type ActivityType,
  type CrmEntityType,
  type ActivityStatus,
} from "@/db/schema/activities";

export { type ActivityType, type CrmEntityType, type ActivityStatus };

export interface ActivityUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface ActivityWithRelations {
  id: string;
  organizationId: string;
  entityType: CrmEntityType;
  entityId: string;
  leadId?: string | null;
  type: ActivityType;
  title: string;
  description: string | null;
  status: ActivityStatus;
  assignedToUserId?: string | null;
  assignedToUser?: ActivityUser | null;
  createdByUserId: string;
  createdByUser: ActivityUser;
  dueAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  task: "Task",
  follow_up: "Follow-up",
  status_change: "Status Change",
  assignment_change: "Assignment Change",
  conversion: "Conversion",
  relationship_change: "Relationship Change",
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface ActivityPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedActivitiesResult {
  data: ActivityWithRelations[];
  pagination: ActivityPagination;
}
