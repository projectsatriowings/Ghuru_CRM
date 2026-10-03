import { requirePermission } from "@/lib/context/organization-context";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { LeadForm } from "@/components/leads/lead-form";

export const metadata = {
  title: "Create Lead - Ghuru CRM",
  description: "Add a new prospective customer",
};

export default async function CreateLeadPage() {
  const ctx = await requirePermission("leads.create");

  const [customFields, membersResult, pipelines] = await Promise.all([
    getCustomFields(ctx.organization.id, {
      entityType: "lead",
      active: true,
    }),
    getOrganizationMembers(ctx.organization.id),
    getActivePipelinesWithStages(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <LeadForm
      mode="create"
      pipelines={pipelines}
      customFieldDefinitions={customFields}
      members={members}
    />
  );
}
