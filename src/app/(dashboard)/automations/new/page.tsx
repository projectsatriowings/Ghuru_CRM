import { requirePermission } from "@/lib/context/organization-context";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { AutomationForm } from "@/components/automations/automation-form";

export const metadata = {
  title: "New Automation - Ghuru CRM",
  description: "Create a new automated rule for your organization",
};

export default async function NewAutomationPage() {
  const ctx = await requirePermission("automations.create");

  const [membersResult, pipelines] = await Promise.all([
    getOrganizationMembers(ctx.organization.id),
    getActivePipelinesWithStages(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="py-2">
      <AutomationForm members={members} pipelines={pipelines} />
    </div>
  );
}
