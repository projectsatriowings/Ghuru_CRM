import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { restoreLead } from "@/lib/services/lead.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("leads.update");

    const restored = await restoreLead(ctx.organization.id, id);

    return apiSuccess({
      message: "Lead restored successfully",
      lead: restored,
    });
  } catch (error) {
    return apiError(error);
  }
}
