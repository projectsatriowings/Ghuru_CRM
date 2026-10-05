import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { restoreDeal } from "@/lib/services/deal.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("deals.update");

    const restored = await restoreDeal(
      ctx.organization.id,
      id,
      undefined,
      ctx.user.id
    );

    return apiSuccess({
      message: "Deal restored successfully",
      deal: restored,
    });
  } catch (error) {
    return apiError(error);
  }
}
