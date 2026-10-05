import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getAutomationById } from "@/lib/services/automation.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { AutomationForm } from "@/components/automations/automation-form";

interface EditAutomationPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditAutomationPageProps) {
  const { id } = await params;
  return {
    title: `Edit Automation - Ghuru CRM`,
    description: `Edit automation configuration for ID ${id}`,
  };
}

export default async function EditAutomationPage({
  params,
}: EditAutomationPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("automations.update");

  let automation;
  let membersResult;
  let pipelines;
  try {
    [automation, membersResult, pipelines] = await Promise.all([
      getAutomationById(ctx.organization.id, id),
      getOrganizationMembers(ctx.organization.id),
      getActivePipelinesWithStages(ctx.organization.id),
    ]);
  } catch {
    notFound();
  }

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="py-2">
      <AutomationForm
        initialData={automation}
        members={members}
        pipelines={pipelines}
        isEdit={true}
      />
    </div>
  );
}
