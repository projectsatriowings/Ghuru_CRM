import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getLeadById } from "@/lib/services/lead.service";
import { getLeadActivities } from "@/lib/services/activity.service";
import { getLeadFollowUps } from "@/lib/services/follow-up.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { type ActivityWithRelations } from "@/lib/types/activities";
import { type FollowUpWithRelations } from "@/lib/types/follow-ups";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LeadDetailPageProps) {
  const { id } = await params;
  return {
    title: `Lead Details - Ghuru CRM`,
    description: `View details for lead ${id}`,
  };
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("leads.view");

  let lead;
  try {
    lead = await getLeadById(ctx.organization.id, id);
  } catch {
    notFound();
  }

  const canViewActivities = ctx.hasPermission("activities.view");
  const canViewFollowUps = ctx.hasPermission("follow_ups.view");

  const [activities, followUps, membersResult, pipelines] = await Promise.all([
    canViewActivities
      ? getLeadActivities(ctx.organization.id, id)
      : Promise.resolve([] as ActivityWithRelations[]),
    canViewFollowUps
      ? getLeadFollowUps(ctx.organization.id, id)
      : Promise.resolve([] as FollowUpWithRelations[]),
    getOrganizationMembers(ctx.organization.id),
    getActivePipelinesWithStages(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <LeadDetailView
      lead={lead}
      pipelines={pipelines}
      activities={activities}
      followUps={followUps}
      members={members}
      currentUserId={ctx.user.id}
      canUpdate={ctx.hasPermission("leads.update")}
      canDelete={ctx.hasPermission("leads.delete")}
      canConvert={ctx.hasPermission("leads.update")}
      canViewActivities={canViewActivities}
      canCreateActivity={ctx.hasPermission("activities.create")}
      canUpdateActivity={ctx.hasPermission("activities.update")}
      canDeleteActivity={ctx.hasPermission("activities.delete")}
      canViewFollowUps={canViewFollowUps}
      canCreateFollowUp={ctx.hasPermission("follow_ups.create")}
      canUpdateFollowUp={ctx.hasPermission("follow_ups.update")}
      canDeleteFollowUp={ctx.hasPermission("follow_ups.delete")}
    />
  );
}
