import { requirePermission } from "@/lib/context/organization-context";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { DealForm } from "@/components/deals/deal-form";

export const metadata = {
  title: "Create Deal - Ghuru CRM",
  description: "Create a new commercial opportunity",
};

export default async function CreateDealPage() {
  const ctx = await requirePermission("deals.create");

  const [customFields, membersResult, pipelines] = await Promise.all([
    getCustomFields(ctx.organization.id, {
      entityType: "deal",
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
    <DealForm
      mode="create"
      pipelines={pipelines}
      customFieldDefinitions={customFields}
      members={members}
    />
  );
}
