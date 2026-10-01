import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { getLeads, createLead } from "@/lib/services/lead.service";
import { createLeadSchema, leadQuerySchema } from "@/lib/validations/lead";
import { apiSuccess, apiPaginatedSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("leads.view");

    const { searchParams } = new URL(req.url);
    const query = leadQuerySchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      source: searchParams.get("source") || undefined,
      assignedTo: searchParams.get("assignedTo") || undefined,
      archived: searchParams.get("archived") || "false",
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 25,
      sort: searchParams.get("sort") || "createdAt",
      sortDirection: searchParams.get("sortDirection") || "desc",
    });

    const result = await getLeads(ctx.organization.id, query);

    return apiPaginatedSuccess(result.data, result.pagination);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("leads.create");

    const body = await req.json();
    const validated = createLeadSchema.parse(body);

    const lead = await createLead(ctx.organization.id, validated);

    return apiSuccess(lead, 201);
  } catch (error) {
    return apiError(error);
  }
}
