import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getCompanyById } from "@/lib/services/company.service";
import { CompanyDetailView } from "@/components/companies/company-detail-view";

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CompanyDetailPageProps) {
  const { id } = await params;
  return {
    title: `Company Details - Ghuru CRM`,
    description: `View details for company ${id}`,
  };
}

export default async function CompanyDetailPage({
  params,
}: CompanyDetailPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("companies.view");

  let company;
  try {
    company = await getCompanyById(ctx.organization.id, id);
  } catch {
    notFound();
  }

  return (
    <CompanyDetailView
      company={company}
      canUpdate={ctx.hasPermission("companies.update")}
      canDelete={ctx.hasPermission("companies.delete")}
    />
  );
}
