import { requirePermission } from "@/lib/context/organization-context";
import { getDeals } from "@/lib/services/deal.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getActivePipelinesWithStages } from "@/lib/services/pipeline.service";
import { DealsTable } from "@/components/deals/deals-table";
import { dealQuerySchema } from "@/lib/validations/deal";

export const metadata = {
  title: "Deals - Ghuru CRM",
  description: "Manage and track commercial opportunities across your organization",
};

interface DealsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    ownerUserId?: string;
    pipelineId?: string;
    pipelineStageId?: string;
    leadId?: string;
    contactId?: string;
    companyId?: string;
    archived?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    sortDirection?: string;
  }>;
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const ctx = await requirePermission("deals.view");
  const rawParams = await searchParams;

  const parsedQuery = dealQuerySchema.parse({
    search: rawParams.search || undefined,
    status: rawParams.status || undefined,
    ownerUserId: rawParams.ownerUserId || undefined,
    pipelineId: rawParams.pipelineId || undefined,
    pipelineStageId: rawParams.pipelineStageId || undefined,
    leadId: rawParams.leadId || undefined,
    contactId: rawParams.contactId || undefined,
    companyId: rawParams.companyId || undefined,
    archived: rawParams.archived || "false",
    page: rawParams.page ? Number(rawParams.page) : 1,
    pageSize: rawParams.pageSize ? Number(rawParams.pageSize) : 25,
    sort: rawParams.sort || "createdAt",
    sortDirection: rawParams.sortDirection || "desc",
  });

  const [dealsResult, membersResult, pipelines] = await Promise.all([
    getDeals(ctx.organization.id, parsedQuery),
    getOrganizationMembers(ctx.organization.id),
    getActivePipelinesWithStages(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="space-y-6">
      <DealsTable
        deals={dealsResult.data}
        pipelines={pipelines}
        pagination={dealsResult.pagination}
        members={members}
        canCreate={ctx.hasPermission("deals.create")}
        canUpdate={ctx.hasPermission("deals.update")}
        canDelete={ctx.hasPermission("deals.delete")}
      />
    </div>
  );
}
