import { requirePermission } from "@/lib/context/organization-context";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { ContactForm } from "@/components/contacts/contact-form";

export const metadata = {
  title: "Create Contact - Ghuru CRM",
  description: "Add a new contact to your organization",
};

export default async function CreateContactPage() {
  const ctx = await requirePermission("contacts.create");

  const [customFields, membersResult] = await Promise.all([
    getCustomFields(ctx.organization.id, {
      entityType: "contact",
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
    <ContactForm
      mode="create"
      customFieldDefinitions={customFields}
      members={members}
    />
  );
}
