import { ActivityType } from "@/db/schema/activities";

export interface ActivityUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface ActivityWithRelations {
  id: string;
  organizationId: string;
  leadId: string;
  type: ActivityType;
  title: string;
  description: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  createdByUser: ActivityUser;
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  task: "Task",
};
