import { type InferSelectModel } from "drizzle-orm";
import { teams, teamMembers } from "@/db/schema/teams";

export type Team = InferSelectModel<typeof teams>;
export type TeamMember = InferSelectModel<typeof teamMembers>;

export interface TeamMemberInfo {
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface TeamWithMembers extends Team {
  memberCount: number;
  members: TeamMemberInfo[];
}
