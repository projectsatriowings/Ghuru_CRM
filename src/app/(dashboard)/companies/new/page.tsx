import { requirePermission } from "@/lib/context/organization-context";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { CompanyForm } from "@/components/companies/company-form";

export const metadata = {
  title: "Create Company - Ghuru CRM",
  description: "Add a new company/organization account to your CRM",
};

export default async function CreateCompanyPage() {
  const ctx = await requirePermission("companies.create");

  const [customFields, membersResult] = await Promise.all([
    getCustomFields(ctx.organization.id, {
      entityType: "company",
      active: true,
    }),
    getOrganizationMembers(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <CompanyForm
      mode="create"
      customFieldDefinitions={customFields}
      members={members}
    />
  );
}
