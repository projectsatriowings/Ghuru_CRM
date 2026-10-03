import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getCompanyById,
  getCompanyContacts,
  getCompanyLeads,
} from "@/lib/services/company.service";
import { getActivitiesForEntity } from "@/lib/services/activity.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { CompanyDetailView } from "@/components/companies/company-detail-view";
import { type ActivityWithRelations } from "@/lib/types/activities";

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
  let contacts;
  let leads;

  try {
    const data = await Promise.all([
      getCompanyById(ctx.organization.id, id),
      getCompanyContacts(ctx.organization.id, id),
      getCompanyLeads(ctx.organization.id, id),
    ]);
    company = data[0];
    contacts = data[1];
    leads = data[2];
  } catch {
    notFound();
  }

  const canViewActivities = ctx.hasPermission("activities.view");

  const [activitiesResult, membersResult] = await Promise.all([
    canViewActivities
      ? getActivitiesForEntity(ctx.organization.id, "company", id, { pageSize: 50 })
      : Promise.resolve({
          data: [] as ActivityWithRelations[],
          pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
        }),
    getOrganizationMembers(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <CompanyDetailView
      company={company}
      contacts={contacts}
      leads={leads}
      activities={activitiesResult.data}
      members={members}
      currentUserId={ctx.user.id}
      canUpdate={ctx.hasPermission("companies.update")}
      canDelete={ctx.hasPermission("companies.delete")}
      canUpdateContacts={ctx.hasPermission("contacts.update")}
      canUpdateLeads={ctx.hasPermission("leads.update")}
      canViewActivities={canViewActivities}
      canCreateActivity={ctx.hasPermission("activities.create")}
      canUpdateActivity={ctx.hasPermission("activities.update")}
      canDeleteActivity={ctx.hasPermission("activities.delete")}
    />
  );
}
