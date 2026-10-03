import { requirePermission } from "@/lib/context/organization-context";
import { getCompanies } from "@/lib/services/company.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { CompaniesTable } from "@/components/companies/companies-table";
import { companyQuerySchema } from "@/lib/validations/company";

export const metadata = {
  title: "Companies - Ghuru CRM",
  description: "Manage organizations and business accounts across your CRM",
};

interface CompaniesPageProps {
  searchParams: Promise<{
    search?: string;
    ownerId?: string;
    archived?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    sortDirection?: string;
  }>;
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const ctx = await requirePermission("companies.view");
  const rawParams = await searchParams;

  const parsedQuery = companyQuerySchema.parse({
    search: rawParams.search || undefined,
    ownerId: rawParams.ownerId || undefined,
    archived: rawParams.archived || "false",
    page: rawParams.page ? Number(rawParams.page) : 1,
    pageSize: rawParams.pageSize ? Number(rawParams.pageSize) : 25,
    sort: (rawParams.sort as "createdAt" | "updatedAt" | "name" | "industry") || "createdAt",
    sortDirection: (rawParams.sortDirection as "asc" | "desc") || "desc",
  });

  const [companiesResult, membersResult] = await Promise.all([
    getCompanies(ctx.organization.id, parsedQuery),
    getOrganizationMembers(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="space-y-6">
      <CompaniesTable
        companies={companiesResult.data}
        pagination={companiesResult.pagination}
        members={members}
        canCreate={ctx.hasPermission("companies.create")}
        canUpdate={ctx.hasPermission("companies.update")}
        canDelete={ctx.hasPermission("companies.delete")}
      />
    </div>
  );
}
