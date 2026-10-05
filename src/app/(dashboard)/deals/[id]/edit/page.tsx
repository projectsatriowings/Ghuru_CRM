import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getDealById } from "@/lib/services/deal.service";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { DealForm } from "@/components/deals/deal-form";

interface EditDealPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditDealPageProps) {
  const { id } = await params;
  return {
    title: `Edit Deal - Ghuru CRM`,
    description: `Edit details for deal ${id}`,
  };
}

export default async function EditDealPage({ params }: EditDealPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("deals.update");

  let data;
  try {
    data = await Promise.all([
      getDealById(ctx.organization.id, id),
      getCustomFields(ctx.organization.id, {
        entityType: "deal",
        active: true,
      }),
      getOrganizationMembers(ctx.organization.id),
      getActivePipelinesWithStages(ctx.organization.id),
    ]);
  } catch {
    notFound();
  }

  const [deal, customFields, membersResult, pipelines] = data;

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <DealForm
      mode="edit"
      initialData={deal}
      pipelines={pipelines}
      customFieldDefinitions={customFields}
      members={members}
    />
  );
}
