import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getContactById } from "@/lib/services/contact.service";
import { getActivitiesForEntity } from "@/lib/services/activity.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { ContactDetailView } from "@/components/contacts/contact-detail-view";
import { type ActivityWithRelations } from "@/lib/types/activities";

interface ContactDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ContactDetailPageProps) {
  const { id } = await params;
  return {
    title: `Contact Details - Ghuru CRM`,
    description: `View details for contact ${id}`,
  };
}

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("contacts.view");

  let contact;
  try {
    contact = await getContactById(ctx.organization.id, id);
  } catch {
    notFound();
  }

  const canViewActivities = ctx.hasPermission("activities.view");

  const [activitiesResult, membersResult] = await Promise.all([
    canViewActivities
      ? getActivitiesForEntity(ctx.organization.id, "contact", id, { pageSize: 50 })
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
    <ContactDetailView
      contact={contact}
      activities={activitiesResult.data}
      members={members}
      currentUserId={ctx.user.id}
      canUpdate={ctx.hasPermission("contacts.update")}
      canDelete={ctx.hasPermission("contacts.delete")}
      canViewActivities={canViewActivities}
      canCreateActivity={ctx.hasPermission("activities.create")}
      canUpdateActivity={ctx.hasPermission("activities.update")}
      canDeleteActivity={ctx.hasPermission("activities.delete")}
    />
  );
}
