import { requirePermission } from "@/lib/context/organization-context";
import { getLeads } from "@/lib/services/lead.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { LeadsTable } from "@/components/leads/leads-table";
import { leadQuerySchema } from "@/lib/validations/lead";

export const metadata = {
  title: "Leads - Ghuru CRM",
  description: "Manage and track prospective customers across your organization",
};

interface LeadsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    source?: string;
    assignedTo?: string;
    archived?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    sortDirection?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const ctx = await requirePermission("leads.view");
  const rawParams = await searchParams;

  const parsedQuery = leadQuerySchema.parse({
    search: rawParams.search || undefined,
    status: rawParams.status || undefined,
    source: rawParams.source || undefined,
    assignedTo: rawParams.assignedTo || undefined,
    archived: rawParams.archived || "false",
    page: rawParams.page ? Number(rawParams.page) : 1,
    pageSize: rawParams.pageSize ? Number(rawParams.pageSize) : 25,
    sort: rawParams.sort || "createdAt",
    sortDirection: rawParams.sortDirection || "desc",
  });

  const [leadsResult, membersResult] = await Promise.all([
    getLeads(ctx.organization.id, parsedQuery),
    getOrganizationMembers(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="space-y-6">
      <LeadsTable
        leads={leadsResult.data}
        pagination={leadsResult.pagination}
        members={members}
        canCreate={ctx.hasPermission("leads.create")}
        canUpdate={ctx.hasPermission("leads.update")}
        canDelete={ctx.hasPermission("leads.delete")}
      />
    </div>
  );
}
