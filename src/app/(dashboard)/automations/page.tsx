import { requirePermission } from "@/lib/context/organization-context";
import { getAutomations } from "@/lib/services/automation.service";
import { AutomationsTable } from "@/components/automations/automations-table";
import { automationQuerySchema } from "@/lib/validations/automation";

export const metadata = {
  title: "Automations - Ghuru CRM",
  description:
    "Define and monitor automated workflows, activities, and follow-ups across your CRM",
};

interface AutomationsPageProps {
  searchParams: Promise<{
    search?: string;
    entityType?: string;
    triggerType?: string;
    status?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    sortDirection?: string;
  }>;
}

export default async function AutomationsPage({
  searchParams,
}: AutomationsPageProps) {
  const ctx = await requirePermission("automations.view");
  const rawParams = await searchParams;

  const parsedQuery = automationQuerySchema.parse(rawParams);

  const automationsResult = await getAutomations(
    ctx.organization.id,
    parsedQuery
  );

  return (
    <div className="space-y-6">
      <AutomationsTable
        automations={automationsResult.data}
        pagination={automationsResult.pagination}
        canCreate={ctx.hasPermission("automations.create")}
        canUpdate={ctx.hasPermission("automations.update")}
        canDelete={ctx.hasPermission("automations.delete")}
      />
    </div>
  );
}
