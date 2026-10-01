import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getLeadById,
  updateLead,
  archiveLead,
} from "@/lib/services/lead.service";
import { updateLeadSchema } from "@/lib/validations/lead";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("leads.view");

    const lead = await getLeadById(ctx.organization.id, id);

    return apiSuccess(lead);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("leads.update");

    const body = await req.json();
    const validated = updateLeadSchema.parse(body);

    const updated = await updateLead(ctx.organization.id, id, validated);

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("leads.delete");

    const archived = await archiveLead(ctx.organization.id, id);

    return apiSuccess({
      message: "Lead archived successfully",
      lead: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
