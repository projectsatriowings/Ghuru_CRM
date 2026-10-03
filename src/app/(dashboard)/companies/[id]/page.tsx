import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getCompanyById,
  getCompanyContacts,
  getCompanyLeads,
} from "@/lib/services/company.service";
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

  let data;
  try {
    data = await Promise.all([
      getCompanyById(ctx.organization.id, id),
      getCompanyContacts(ctx.organization.id, id),
      getCompanyLeads(ctx.organization.id, id),
    ]);
  } catch {
    notFound();
  }

  const [company, contacts, leads] = data;

  return (
    <CompanyDetailView
      company={company}
      contacts={contacts}
      leads={leads}
      canUpdate={ctx.hasPermission("companies.update")}
      canDelete={ctx.hasPermission("companies.delete")}
      canUpdateContacts={ctx.hasPermission("contacts.update")}
      canUpdateLeads={ctx.hasPermission("leads.update")}
    />
  );
}
