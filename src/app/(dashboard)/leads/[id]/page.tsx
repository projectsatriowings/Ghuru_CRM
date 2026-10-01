import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getLeadById } from "@/lib/services/lead.service";
import { LeadDetailView } from "@/components/leads/lead-detail-view";

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

  return (
    <LeadDetailView
      lead={lead}
      canUpdate={ctx.hasPermission("leads.update")}
      canDelete={ctx.hasPermission("leads.delete")}
    />
  );
}
