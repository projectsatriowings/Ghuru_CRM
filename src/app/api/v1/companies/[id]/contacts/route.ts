import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getCompanyContacts,
  setContactCompany,
} from "@/lib/services/company.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const associateContactSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  isPrimaryContact: z.boolean().optional().default(false),
});

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("companies.view");

    const contacts = await getCompanyContacts(ctx.organization.id, id);

    return apiSuccess(contacts);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = await params;
    const ctx = await requirePermission("contacts.update");

    const body = await req.json();
    const validated = associateContactSchema.parse(body);

    await setContactCompany(
      ctx.organization.id,
      validated.contactId,
      companyId,
      validated.isPrimaryContact
    );

    const contacts = await getCompanyContacts(ctx.organization.id, companyId);

    return apiSuccess({
      message: "Contact associated with company successfully",
      contacts,
    });
  } catch (error) {
    return apiError(error);
  }
}
