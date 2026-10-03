import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getLeadById } from "@/lib/services/lead.service";
import { getLeadActivities } from "@/lib/services/activity.service";
import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { type ActivityWithRelations } from "@/lib/types/activities";

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
  let activities: ActivityWithRelations[] = [];
  if (canViewActivities) {
    activities = await getLeadActivities(ctx.organization.id, id);
  }

  return (
    <LeadDetailView
      lead={lead}
      activities={activities}
      canUpdate={ctx.hasPermission("leads.update")}
      canDelete={ctx.hasPermission("leads.delete")}
      canViewActivities={canViewActivities}
      canCreateActivity={ctx.hasPermission("activities.create")}
      canUpdateActivity={ctx.hasPermission("activities.update")}
      canDeleteActivity={ctx.hasPermission("activities.delete")}
    />
  );
}
