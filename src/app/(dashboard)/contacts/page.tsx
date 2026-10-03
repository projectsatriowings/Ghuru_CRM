import { requirePermission } from "@/lib/context/organization-context";
import { getContacts } from "@/lib/services/contact.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { contactQuerySchema } from "@/lib/validations/contact";

export const metadata = {
  title: "Contacts - Ghuru CRM",
  description: "Manage and track contacts across your organization",
};

interface ContactsPageProps {
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

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const ctx = await requirePermission("contacts.view");
  const rawParams = await searchParams;

  const parsedQuery = contactQuerySchema.parse({
    search: rawParams.search || undefined,
    ownerId: rawParams.ownerId || undefined,
    archived: rawParams.archived || "false",
    page: rawParams.page ? Number(rawParams.page) : 1,
    pageSize: rawParams.pageSize ? Number(rawParams.pageSize) : 25,
    sort: (rawParams.sort as "createdAt" | "updatedAt" | "firstName" | "lastName") || "createdAt",
    sortDirection: (rawParams.sortDirection as "asc" | "desc") || "desc",
  });

  const [contactsResult, membersResult] = await Promise.all([
    getContacts(ctx.organization.id, parsedQuery),
    getOrganizationMembers(ctx.organization.id),
  ]);

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="space-y-6">
      <ContactsTable
        contacts={contactsResult.data}
        pagination={contactsResult.pagination}
        members={members}
        canCreate={ctx.hasPermission("contacts.create")}
        canUpdate={ctx.hasPermission("contacts.update")}
        canDelete={ctx.hasPermission("contacts.delete")}
      />
    </div>
  );
}
