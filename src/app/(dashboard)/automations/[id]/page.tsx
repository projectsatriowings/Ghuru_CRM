import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getAutomationById,
  getAutomationExecutions,
} from "@/lib/services/automation.service";
import { AutomationDetailView } from "@/components/automations/automation-detail-view";

interface AutomationDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AutomationDetailPageProps) {
  const { id } = await params;
  return {
    title: `Automation Details - Ghuru CRM`,
    description: `View automation rules and execution history for ID ${id}`,
  };
}

export default async function AutomationDetailPage({
  params,
}: AutomationDetailPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("automations.view");

  let automation;
  let executionsResult;
  try {
    [automation, executionsResult] = await Promise.all([
      getAutomationById(ctx.organization.id, id),
      getAutomationExecutions(ctx.organization.id, {
        automationId: id,
        pageSize: 50,
      }),
    ]);
  } catch {
    notFound();
  }

  return (
    <div className="py-2">
      <AutomationDetailView
        automation={automation}
        executions={executionsResult.data}
        canUpdate={ctx.hasPermission("automations.update")}
        canDelete={ctx.hasPermission("automations.delete")}
      />
    </div>
  );
}
