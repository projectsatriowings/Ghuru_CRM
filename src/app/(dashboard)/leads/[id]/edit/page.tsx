import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getLeadById } from "@/lib/services/lead.service";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { LeadForm } from "@/components/leads/lead-form";

interface EditLeadPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditLeadPageProps) {
  const { id } = await params;
  return {
    title: `Edit Lead - Ghuru CRM`,
    description: `Edit details for lead ${id}`,
  };
}

export default async function EditLeadPage({ params }: EditLeadPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("leads.update");

  let data;
  try {
    data = await Promise.all([
      getLeadById(ctx.organization.id, id),
      getCustomFields(ctx.organization.id, {
        entityType: "lead",
        active: true,
      }),
      getOrganizationMembers(ctx.organization.id),
      getActivePipelinesWithStages(ctx.organization.id),
    ]);
  } catch {
    notFound();
  }

  const [lead, customFields, membersResult, pipelines] = data;

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <LeadForm
      mode="edit"
      initialData={lead}
      pipelines={pipelines}
      customFieldDefinitions={customFields}
      members={members}
    />
  );
}
