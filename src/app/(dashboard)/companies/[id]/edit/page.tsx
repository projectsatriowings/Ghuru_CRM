import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getCompanyById } from "@/lib/services/company.service";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { CompanyForm } from "@/components/companies/company-form";

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditCompanyPageProps) {
  const { id } = await params;
  return {
    title: `Edit Company - Ghuru CRM`,
    description: `Edit details for company ${id}`,
  };
}

export default async function EditCompanyPage({
  params,
}: EditCompanyPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("companies.update");

  let data;
  try {
    data = await Promise.all([
      getCompanyById(ctx.organization.id, id),
      getCustomFields(ctx.organization.id, {
        entityType: "company",
        active: true,
      }),
      getOrganizationMembers(ctx.organization.id),
    ]);
  } catch {
    notFound();
  }

  const [company, customFields, membersResult] = data;

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <CompanyForm
      mode="edit"
      initialData={company}
      customFieldDefinitions={customFields}
      members={members}
    />
  );
}
