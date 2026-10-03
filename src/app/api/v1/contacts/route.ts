import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { getContacts, createContact } from "@/lib/services/contact.service";
import {
  createContactSchema,
  contactQuerySchema,
} from "@/lib/validations/contact";
import {
  apiSuccess,
  apiPaginatedSuccess,
  apiError,
} from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("contacts.view");

    const { searchParams } = new URL(req.url);
    const query = contactQuerySchema.parse({
      search: searchParams.get("search") || undefined,
      ownerId: searchParams.get("ownerId") || undefined,
      archived: searchParams.get("archived") || "false",
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 25,
      sort: searchParams.get("sort") || "createdAt",
      sortDirection: searchParams.get("sortDirection") || "desc",
    });

    const result = await getContacts(ctx.organization.id, query);

    return apiPaginatedSuccess(result.data, result.pagination);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("contacts.create");

    const body = await req.json();
    const validated = createContactSchema.parse(body);

    const contact = await createContact(ctx.organization.id, validated);

    return apiSuccess(contact, 201);
  } catch (error) {
    return apiError(error);
  }
}
