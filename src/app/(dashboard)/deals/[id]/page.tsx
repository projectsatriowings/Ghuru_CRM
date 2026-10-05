import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getDealById } from "@/lib/services/deal.service";
import { getDealActivities } from "@/lib/services/activity.service";
import { getDealFollowUps } from "@/lib/services/follow-up.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { DealDetailView } from "@/components/deals/deal-detail-view";
import { type ActivityWithRelations } from "@/lib/types/activities";
import { type FollowUpWithRelations } from "@/lib/types/follow-ups";

interface DealDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DealDetailPageProps) {
  const { id } = await params;
  return {
    title: `Deal Details - Ghuru CRM`,
    description: `View details for deal ${id}`,
  };
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("deals.view");

  let deal;
  try {
    deal = await getDealById(ctx.organization.id, id);
  } catch {
    notFound();
  }

  const canViewActivities = ctx.hasPermission("activities.view");
  const canViewFollowUps = ctx.hasPermission("follow_ups.view");

  const [activities, followUps, membersResult, pipelines] = await Promise.all([
    canViewActivities
      ? getDealActivities(ctx.organization.id, id)
      : Promise.resolve([] as ActivityWithRelations[]),
    canViewFollowUps
      ? getDealFollowUps(ctx.organization.id, id)
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
    <DealDetailView
      deal={deal}
      pipelines={pipelines}
      activities={activities}
      followUps={followUps}
      members={members}
      currentUserId={ctx.user.id}
      canUpdate={ctx.hasPermission("deals.update")}
      canDelete={ctx.hasPermission("deals.delete")}
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
