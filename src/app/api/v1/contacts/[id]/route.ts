import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getContactById,
  updateContact,
  archiveContact,
} from "@/lib/services/contact.service";
import { updateContactSchema } from "@/lib/validations/contact";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("contacts.view");

    const contact = await getContactById(ctx.organization.id, id);

    return apiSuccess(contact);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("contacts.update");

    const body = await req.json();
    const validated = updateContactSchema.parse(body);

    const updated = await updateContact(ctx.organization.id, id, validated);

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("contacts.delete");

    const archived = await archiveContact(ctx.organization.id, id);

    return apiSuccess({
      message: "Contact archived successfully",
      contact: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
