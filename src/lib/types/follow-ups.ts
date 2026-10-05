import { FollowUpStatus } from "@/db/schema/follow-ups";

export interface FollowUpUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface FollowUpWithRelations {
  id: string;
  organizationId: string;
  leadId?: string | null;
  dealId?: string | null;
  assignedToUserId: string | null;
  title: string;
  description: string | null;
  dueDate: string;
  dueTime: string | null;
  status: FollowUpStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  archivedAt: Date | null;
  assignedToUser?: FollowUpUser | null;
  createdByUser: FollowUpUser;
}

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};
