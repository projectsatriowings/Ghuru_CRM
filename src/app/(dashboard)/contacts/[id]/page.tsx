import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getContactById } from "@/lib/services/contact.service";
import { ContactDetailView } from "@/components/contacts/contact-detail-view";

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

  return (
    <ContactDetailView
      contact={contact}
      canUpdate={ctx.hasPermission("contacts.update")}
      canDelete={ctx.hasPermission("contacts.delete")}
    />
  );
}
