import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getAutomationById,
  updateAutomation,
  archiveAutomation,
} from "@/lib/services/automation.service";
import { updateAutomationSchema } from "@/lib/validations/automation";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("automations.view");

    const automation = await getAutomationById(ctx.organization.id, id);

    return apiSuccess(automation);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("automations.update");

    const body = await req.json();
    const validated = updateAutomationSchema.parse(body);

    const updated = await updateAutomation(
      ctx.organization.id,
      id,
      validated
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("automations.delete");

    const archived = await archiveAutomation(ctx.organization.id, id);

    return apiSuccess({
      message: "Automation archived successfully",
      automation: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
