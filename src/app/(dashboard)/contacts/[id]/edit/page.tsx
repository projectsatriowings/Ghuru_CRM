import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getContactById } from "@/lib/services/contact.service";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getCompanies } from "@/lib/services/company.service";
import { ContactForm } from "@/components/contacts/contact-form";

interface EditContactPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditContactPageProps) {
  const { id } = await params;
  return {
    title: `Edit Contact - Ghuru CRM`,
    description: `Edit details for contact ${id}`,
  };
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  const { id } = await params;
  const ctx = await requirePermission("contacts.update");

  let data;
  try {
    data = await Promise.all([
      getContactById(ctx.organization.id, id),
      getCustomFields(ctx.organization.id, {
        entityType: "contact",
        active: true,
      }),
      getOrganizationMembers(ctx.organization.id),
      getCompanies(ctx.organization.id, { pageSize: 20, archived: "false" }),
    ]);
  } catch {
    notFound();
  }

  const [contact, customFields, membersResult, companiesResult] = data;

  const members = membersResult.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  const companies = companiesResult.data.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <ContactForm
      mode="edit"
      initialData={contact}
      customFieldDefinitions={customFields}
      members={members}
      companies={companies}
    />
  );
}
