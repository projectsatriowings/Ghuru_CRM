import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { restoreAutomation } from "@/lib/services/automation.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("automations.update");

    const restored = await restoreAutomation(ctx.organization.id, id);

    return apiSuccess({
      message: "Automation restored successfully",
      automation: restored,
    });
  } catch (error) {
    return apiError(error);
  }
}
